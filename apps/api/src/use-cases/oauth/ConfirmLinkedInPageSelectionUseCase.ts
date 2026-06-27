import { persistLinkedInPageConnection } from './persistLinkedInPageConnection.js'
import type { LinkedInOrganization } from '../../lib/linkedin-page-client.js'
import type { OAuthConnection, OAuthRepository, TokenVaultPort } from '@socialshelf/domain'

const PENDING_SELECTION_TTL_MS = 10 * 60 * 1000

interface PendingSelection {
  userId: string
  brandId: string
  access_token: string
  refresh_token: string | null
  expires_in: number
  scope: string
  organizations: LinkedInOrganization[]
  iat: number
}

export class ConfirmLinkedInPageSelectionUseCase {
  constructor(
    private readonly oauthRepo: OAuthRepository,
    private readonly tokenVault: TokenVaultPort,
  ) {}

  async execute(
    pendingId: string,
    userId: string,
    organizationUrn: string,
  ): Promise<OAuthConnection> {
    const vaultRef = `linkedin-page-pending-${pendingId}`
    const raw = await this.tokenVault.retrieve(vaultRef)
    const pending = JSON.parse(raw) as PendingSelection

    if (pending.userId !== userId) {
      throw new Error('linkedin_pending_selection_not_found')
    }

    if (Date.now() - pending.iat > PENDING_SELECTION_TTL_MS) {
      await this.tokenVault.delete(vaultRef)
      throw new Error('linkedin_pending_selection_expired')
    }

    const isValidOrg = pending.organizations.some((org) => org.urn === organizationUrn)
    if (!isValidOrg) {
      throw new Error('linkedin_invalid_organization')
    }

    const connection = await persistLinkedInPageConnection(
      this.oauthRepo,
      this.tokenVault,
      pending.userId,
      pending.brandId,
      {
        access_token: pending.access_token,
        refresh_token: pending.refresh_token,
        expires_in: pending.expires_in,
        scope: pending.scope,
      },
      organizationUrn,
    )

    await this.tokenVault.delete(vaultRef)
    return connection
  }
}
