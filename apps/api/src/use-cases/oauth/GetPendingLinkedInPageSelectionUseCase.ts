import type { LinkedInOrganization } from '../../lib/linkedin-page-client.js'
import type { TokenVaultPort } from '@socialshelf/domain'

const PENDING_SELECTION_TTL_MS = 10 * 60 * 1000

interface PendingSelection {
  userId: string
  organizations: LinkedInOrganization[]
  iat: number
}

export class GetPendingLinkedInPageSelectionUseCase {
  constructor(private readonly tokenVault: TokenVaultPort) {}

  async execute(pendingId: string, userId: string): Promise<{ organizations: LinkedInOrganization[] }> {
    const raw = await this.tokenVault.retrieve(`linkedin-page-pending-${pendingId}`)
    const pending = JSON.parse(raw) as PendingSelection

    if (pending.userId !== userId) {
      throw new Error('linkedin_pending_selection_not_found')
    }

    if (Date.now() - pending.iat > PENDING_SELECTION_TTL_MS) {
      throw new Error('linkedin_pending_selection_expired')
    }

    return { organizations: pending.organizations }
  }
}
