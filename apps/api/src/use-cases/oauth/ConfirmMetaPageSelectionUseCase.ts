import { persistMetaPageConnection, type MetaConnectionResult } from './persistMetaPageConnection.js'
import type { MetaPage } from '../../lib/meta-client.js'
import type { OAuthRepository, TokenVaultPort } from '@socialshelf/domain'

const PENDING_SELECTION_TTL_MS = 10 * 60 * 1000

interface PendingSelection {
  userId: string
  brandId: string
  user_access_token: string
  expiresAt: string
  pages: MetaPage[]
  iat: number
}

export class ConfirmMetaPageSelectionUseCase {
  constructor(
    private readonly oauthRepo: OAuthRepository,
    private readonly tokenVault: TokenVaultPort,
  ) {}

  async execute(pendingId: string, userId: string, pageId: string): Promise<MetaConnectionResult> {
    const vaultRef = `meta-page-pending-${pendingId}`
    const raw = await this.tokenVault.retrieve(vaultRef)
    const pending = JSON.parse(raw) as PendingSelection

    if (pending.userId !== userId) {
      throw new Error('meta_pending_selection_not_found')
    }

    if (Date.now() - pending.iat > PENDING_SELECTION_TTL_MS) {
      await this.tokenVault.delete(vaultRef)
      throw new Error('meta_pending_selection_expired')
    }

    const page = pending.pages.find((p) => p.id === pageId)
    if (!page) {
      throw new Error('meta_invalid_page')
    }

    const result = await persistMetaPageConnection(
      this.oauthRepo,
      this.tokenVault,
      pending.userId,
      pending.brandId,
      pending.user_access_token,
      new Date(pending.expiresAt),
      page,
    )

    await this.tokenVault.delete(vaultRef)
    return result
  }
}
