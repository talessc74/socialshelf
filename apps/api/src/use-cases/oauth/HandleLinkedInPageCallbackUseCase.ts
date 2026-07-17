import { randomUUID } from 'crypto'
import {
  exchangeCodeForPageToken,
  listAdministeredOrganizations,
  type LinkedInOrganization,
} from '../../lib/linkedin-page-client.js'
import { persistLinkedInPageConnection } from './persistLinkedInPageConnection.js'
import type { OAuthConnection, OAuthRepository, TokenVaultPort } from '@socialshelf/domain'

export type HandleLinkedInPageCallbackResult =
  | { status: 'connected'; connection: OAuthConnection }
  | { status: 'pending'; pendingId: string; organizations: LinkedInOrganization[] }

export class HandleLinkedInPageCallbackUseCase {
  constructor(
    private readonly oauthRepo: OAuthRepository,
    private readonly tokenVault: TokenVaultPort,
  ) {}

  async execute(code: string, userId: string, brandId: string): Promise<HandleLinkedInPageCallbackResult> {
    const redirectUri = process.env['LINKEDIN_PAGE_REDIRECT_URI'] ?? ''
    const tokenResponse = await exchangeCodeForPageToken(code, redirectUri)
    const organizations = await listAdministeredOrganizations(tokenResponse.access_token)

    if (organizations.length === 0) {
      throw new Error('linkedin_no_organizations')
    }

    if (organizations.length === 1) {
      const connection = await persistLinkedInPageConnection(
        this.oauthRepo,
        this.tokenVault,
        userId,
        brandId,
        tokenResponse,
        organizations[0]!.urn,
        organizations[0]!.name,
      )
      return { status: 'connected', connection }
    }

    // Várias páginas administradas: guarda o token temporariamente no vault e devolve a
    // lista para o usuário escolher — a conexão só é persistida em ConfirmLinkedInPageSelectionUseCase.
    const pendingId = randomUUID()
    await this.tokenVault.store(
      `linkedin-page-pending-${pendingId}`,
      JSON.stringify({
        userId,
        brandId,
        access_token: tokenResponse.access_token,
        refresh_token: tokenResponse.refresh_token ?? null,
        expires_in: tokenResponse.expires_in,
        scope: tokenResponse.scope,
        organizations,
        iat: Date.now(),
      }),
    )

    return { status: 'pending', pendingId, organizations }
  }
}
