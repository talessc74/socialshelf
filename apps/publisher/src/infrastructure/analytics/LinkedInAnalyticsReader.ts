import type { AnalyticsReaderPort, PostMetrics, OAuthConnection, TokenVaultPort } from '@socialshelf/domain'
import { refreshLinkedInToken } from '../../lib/linkedin-refresh.js'
import { RECONNECT_REQUIRED_MESSAGE } from '../../lib/platformErrorMessages.js'

const LI_REST = 'https://api.linkedin.com/rest'
// Lançada em fev/2026 — sunset estimado fev/2027 (suporte mínimo de 12 meses garantido pela LinkedIn)
const LI_VERSION = '202602'

interface LinkedInToken {
  access_token: string
  refresh_token?: string | null
}

interface LinkedInSocialActions {
  likesSummary: { totalLikes: number }
  commentsSummary: { totalFirstLevelComments: number }
}

export class LinkedInAnalyticsReader implements AnalyticsReaderPort {
  constructor(private readonly tokenVault: TokenVaultPort) {}

  async fetchPostMetrics(externalId: string, connection: OAuthConnection): Promise<PostMetrics> {
    const raw = await this.tokenVault.retrieve(connection.tokenRef)
    let token: LinkedInToken = JSON.parse(raw)

    let response = await this.getSocialActions(externalId, token.access_token)

    // Mesmo padrão reativo de LinkedInPublisher (_local-adr-policy-016, emenda 2026-11-22).
    if (response.status === 401 && token.refresh_token) {
      const refreshed = await refreshLinkedInToken(token.refresh_token)
      token = { access_token: refreshed.access_token, refresh_token: refreshed.refresh_token ?? token.refresh_token }
      await this.tokenVault.store(connection.tokenRef, JSON.stringify(token))
      response = await this.getSocialActions(externalId, token.access_token)
    }

    if (!response.ok) {
      const err = await response.text()
      // Chegar até aqui com 401 já passou pelo refresh acima (ou não tinha refresh_token) —
      // o token em si está irrecuperável, só reconexão manual resolve.
      if (response.status === 401) {
        throw new Error(`LinkedIn metrics fetch failed: ${RECONNECT_REQUIRED_MESSAGE} — reconecte em Central de Contas`)
      }
      throw new Error(`LinkedIn metrics fetch failed: ${response.status} ${err}`)
    }

    const data = (await response.json()) as LinkedInSocialActions

    // socialActions não expõe impressões nem reposts para posts de membro — apenas reactions/comments
    return {
      impressions: 0,
      likes: data.likesSummary.totalLikes,
      comments: data.commentsSummary.totalFirstLevelComments,
      shares: 0,
    }
  }

  private getSocialActions(externalId: string, accessToken: string): Promise<Response> {
    return fetch(`${LI_REST}/socialActions/${encodeURIComponent(externalId)}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'LinkedIn-Version': LI_VERSION,
      },
    })
  }
}
