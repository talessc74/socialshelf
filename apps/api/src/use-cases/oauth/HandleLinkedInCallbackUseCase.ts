import { randomUUID } from 'crypto'
import { exchangeCodeForToken, listAdministeredOrganizations } from '../../lib/linkedin-client.js'
import { Platform, derivePairwiseId } from '@socialshelf/domain'
import type { OAuthConnection, OAuthRepository, TokenVaultPort } from '@socialshelf/domain'

export class HandleLinkedInCallbackUseCase {
  constructor(
    private readonly oauthRepo: OAuthRepository,
    private readonly tokenVault: TokenVaultPort,
  ) {}

  async execute(code: string, userId: string, brandId: string): Promise<OAuthConnection> {
    const redirectUri = process.env['LINKEDIN_REDIRECT_URI'] ?? ''
    const tokenResponse = await exchangeCodeForToken(code, redirectUri)

    const pairwiseId = derivePairwiseId(userId, Platform.LINKEDIN)
    const tokenRef = `oauth-token-${pairwiseId}`

    const organizations = await listAdministeredOrganizations(tokenResponse.access_token)
    if (organizations.length > 1) {
      throw new Error('linkedin_multiple_organizations')
    }
    const organizationUrn = organizations[0]?.urn ?? null

    await this.tokenVault.store(
      tokenRef,
      JSON.stringify({
        access_token: tokenResponse.access_token,
        refresh_token: tokenResponse.refresh_token ?? null,
        expires_at: Date.now() + tokenResponse.expires_in * 1000,
        scope: tokenResponse.scope,
      }),
    )

    const connection: OAuthConnection = {
      id: randomUUID(),
      userId,
      brandId,
      platform: Platform.LINKEDIN,
      pairwiseId,
      tokenRef,
      scopes: tokenResponse.scope.split(' '),
      organizationUrn,
      expiresAt: new Date(Date.now() + tokenResponse.expires_in * 1000),
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    await this.oauthRepo.save(connection)

    return connection
  }
}
