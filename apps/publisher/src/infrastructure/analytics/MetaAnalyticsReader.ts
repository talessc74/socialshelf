import { Platform, ContentNotFoundError } from '@socialshelf/domain'
import type { AnalyticsReaderPort, PostMetrics, OAuthConnection, TokenVaultPort } from '@socialshelf/domain'

const GRAPH = 'https://graph.facebook.com/v21.0'

// Meta's signature for "this object was deleted or never existed" — e.g. the user
// removed the post directly on Instagram/Facebook after we published it. Distinct
// from auth/permission errors (code 10) or rate limiting, which are transient.
function isContentDeletedError(body: string): boolean {
  try {
    const parsed = JSON.parse(body) as { error?: { code?: number; error_subcode?: number } }
    return parsed.error?.code === 100 && parsed.error?.error_subcode === 33
  } catch {
    return false
  }
}

// code 10 é o código genérico da Graph API pra "sem permissão pra essa ação" — cobre tanto
// uma métrica pedida que não existe mais (mesma classe do #100 de impressions/shares acima,
// só que devolvido com cara de erro de permissão em vez de "métrica desconhecida") quanto a
// conta não estar liberada como testadora do app em modo de desenvolvimento (mesma exigência
// documentada em MetaPublisher.friendlyReason pra publicar). Sem essa tradução, a tela de
// Performance mostrava o JSON cru da Graph API — mesmo problema já corrigido na publicação.
const INSIGHTS_PERMISSION_ERROR_CODE = 10

function friendlyReason(status: number, rawBody: string): string {
  let graphError: { message?: string; code?: number } | undefined
  try {
    graphError = (JSON.parse(rawBody) as { error?: { message?: string; code?: number } }).error
  } catch {
    graphError = undefined
  }

  if (graphError?.code === INSIGHTS_PERMISSION_ERROR_CODE) {
    return 'sem permissão pra ler métricas dessa rede — confirme que a conta está liberada como testadora do app (mesma exigência pra publicar) e reconecte em Central de Contas'
  }
  if (graphError?.message) {
    return graphError.message
  }
  return `HTTP ${status}`
}

const IG_GRAPH = 'https://graph.instagram.com/v21.0'

interface FacebookToken {
  page_access_token: string
}

// Dois formatos convivem no vault para o Instagram: o legado via Facebook Login
// (page_access_token) e o do Login do Instagram (auth_kind: 'instagram_login', access_token) —
// este último fala com graph.instagram.com usando o token da própria conta
// (_local-edr-policy-057). O endpoint /insights tem o mesmo formato nos dois hosts.
interface InstagramToken {
  auth_kind?: string
  page_access_token?: string
  access_token?: string
}

function resolveInstagramAuth(token: InstagramToken): { graphBase: string; accessToken: string } {
  if (token.auth_kind === 'instagram_login') {
    return { graphBase: IG_GRAPH, accessToken: token.access_token ?? '' }
  }
  return { graphBase: GRAPH, accessToken: token.page_access_token ?? '' }
}

interface FacebookPostFields {
  insights: { data: Array<{ values: Array<{ value: number }> }> }
  likes: { summary: { total_count: number } }
  comments: { summary: { total_count: number } }
  shares?: { count: number }
}

interface InstagramMediaInsights {
  data: Array<{ name: string; values: Array<{ value: number }> }>
}

export class MetaAnalyticsReader implements AnalyticsReaderPort {
  constructor(private readonly tokenVault: TokenVaultPort) {}

  async fetchPostMetrics(externalId: string, connection: OAuthConnection): Promise<PostMetrics> {
    if (connection.platform === Platform.INSTAGRAM) {
      return this.fetchInstagramMetrics(externalId, connection)
    }
    return this.fetchFacebookMetrics(externalId, connection)
  }

  private async fetchFacebookMetrics(externalId: string, connection: OAuthConnection): Promise<PostMetrics> {
    const raw = await this.tokenVault.retrieve(connection.tokenRef)
    const token: FacebookToken = JSON.parse(raw)

    // Meta deprecated "post_impressions" (and related impressions metrics) for Page posts on
    // Nov 15, 2025 — requesting it now fails the whole call with OAuthException #100.
    // "post_media_view" is Meta's designated replacement.
    const fields = 'insights.metric(post_media_view),likes.summary(true),comments.summary(true),shares'
    const params = new URLSearchParams({ fields, access_token: token.page_access_token })

    const response = await fetch(`${GRAPH}/${externalId}?${params.toString()}`)

    if (!response.ok) {
      const err = await response.text()
      if (isContentDeletedError(err)) {
        throw new ContentNotFoundError(`Facebook post ${externalId} no longer exists`)
      }
      throw new Error(`Facebook metrics fetch failed: ${friendlyReason(response.status, err)}`)
    }

    const data = (await response.json()) as FacebookPostFields

    return {
      impressions: data.insights.data[0]?.values[0]?.value ?? 0,
      likes: data.likes.summary.total_count,
      comments: data.comments.summary.total_count,
      shares: data.shares?.count ?? 0,
    }
  }

  private async fetchInstagramMetrics(externalId: string, connection: OAuthConnection): Promise<PostMetrics> {
    const raw = await this.tokenVault.retrieve(connection.tokenRef)
    const token: InstagramToken = JSON.parse(raw)
    const auth = resolveInstagramAuth(token)

    // Meta deprecated the "impressions" metric for Instagram media insights; requesting it now
    // fails the whole call with OAuthException #10. "reach" is the supported replacement. Meta
    // also renamed "shares" to "sends" — same failure mode (IGApiException #10, "Application
    // does not have permission for this action": Meta's insights endpoint rejects the entire
    // request, with a permission-shaped error, when any single requested metric name is stale).
    const params = new URLSearchParams({
      metric: 'reach,likes,comments,sends',
      access_token: auth.accessToken,
    })

    const response = await fetch(`${auth.graphBase}/${externalId}/insights?${params.toString()}`)

    if (!response.ok) {
      const err = await response.text()
      if (isContentDeletedError(err)) {
        throw new ContentNotFoundError(`Instagram media ${externalId} no longer exists`)
      }
      throw new Error(`Instagram metrics fetch failed: ${friendlyReason(response.status, err)}`)
    }

    const data = (await response.json()) as InstagramMediaInsights
    const metric = (name: string) => data.data.find((m) => m.name === name)?.values[0]?.value ?? 0

    return {
      impressions: metric('reach'),
      likes: metric('likes'),
      comments: metric('comments'),
      shares: metric('sends'),
    }
  }
}
