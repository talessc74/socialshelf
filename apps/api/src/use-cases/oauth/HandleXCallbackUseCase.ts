import { randomUUID } from 'crypto'
import { exchangeCodeForXToken } from '../../lib/x-client.js'
import { Platform, derivePairwiseId } from '@socialshelf/domain'
import type { OAuthConnection, OAuthRepository, TokenVaultPort } from '@socialshelf/domain'

export class HandleXCallbackUseCase {
  constructor(
    private readonly oauthRepo: OAuthRepository,
    private readonly tokenVault: TokenVaultPort,
  ) {}

  async execute(
    code: string,
    codeVerifier: string,
    userId: string,
    brandId: string,
  ): Promise<OAuthConnection> {
    const tokenResponse = await exchangeCodeForXToken(code, codeVerifier)

    const pairwiseId = derivePairwiseId(userId, Platform.TWITTER)
    const tokenRef = `oauth-token-${pairwiseId}`

    const expiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000)

    await this.tokenVault.store(
      tokenRef,
      JSON.stringify({
        access_token: tokenResponse.access_token,
        refresh_token: tokenResponse.refresh_token ?? null,
        expires_at: expiresAt.toISOString(),
        scope: tokenResponse.scope,
      }),
    )

    const connection: OAuthConnection = {
      id: randomUUID(),
      userId,
      brandId,
      platform: Platform.TWITTER,
      pairwiseId,
      tokenRef,
      scopes: tokenResponse.scope.split(' '),
      expiresAt,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    await this.oauthRepo.save(connection)

    return connection
  }
}
