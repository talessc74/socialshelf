import { Platform } from '@socialshelf/domain'
import type { AnalyticsReaderPort, PostMetrics, OAuthConnection, TokenVaultPort } from '@socialshelf/domain'

const GRAPH = 'https://graph.facebook.com/v21.0'

interface FacebookToken {
  page_access_token: string
}

interface InstagramToken {
  page_access_token: string
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

    const fields = 'insights.metric(post_impressions),likes.summary(true),comments.summary(true),shares'
    const params = new URLSearchParams({ fields, access_token: token.page_access_token })

    const response = await fetch(`${GRAPH}/${externalId}?${params.toString()}`)

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`Facebook metrics fetch failed: ${response.status} ${err}`)
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

    // Meta deprecated the "impressions" metric for Instagram media insights; requesting it now
    // fails the whole call with OAuthException #10. "reach" is the supported replacement.
    const params = new URLSearchParams({
      metric: 'reach,likes,comments,shares',
      access_token: token.page_access_token,
    })

    const response = await fetch(`${GRAPH}/${externalId}/insights?${params.toString()}`)

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`Instagram metrics fetch failed: ${response.status} ${err}`)
    }

    const data = (await response.json()) as InstagramMediaInsights
    const metric = (name: string) => data.data.find((m) => m.name === name)?.values[0]?.value ?? 0

    return {
      impressions: metric('reach'),
      likes: metric('likes'),
      comments: metric('comments'),
      shares: metric('shares'),
    }
  }
}
