import type { TokenVaultPort } from '@socialshelf/domain'
import type { MetaPage } from '../../lib/meta-client.js'

const PENDING_SELECTION_TTL_MS = 10 * 60 * 1000

interface PendingSelection {
  userId: string
  pages: MetaPage[]
  iat: number
}

export class GetPendingMetaPageSelectionUseCase {
  constructor(private readonly tokenVault: TokenVaultPort) {}

  async execute(pendingId: string, userId: string): Promise<{ pages: MetaPage[] }> {
    const raw = await this.tokenVault.retrieve(`meta-page-pending-${pendingId}`)
    const pending = JSON.parse(raw) as PendingSelection

    if (pending.userId !== userId) {
      throw new Error('meta_pending_selection_not_found')
    }

    if (Date.now() - pending.iat > PENDING_SELECTION_TTL_MS) {
      throw new Error('meta_pending_selection_expired')
    }

    return { pages: pending.pages }
  }
}
