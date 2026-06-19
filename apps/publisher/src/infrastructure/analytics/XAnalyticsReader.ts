import type { AnalyticsReaderPort, PostMetrics, OAuthConnection, TokenVaultPort } from '@socialshelf/domain'

const X_API = 'https://api.twitter.com/2'

interface XStoredToken {
  access_token: string
}

interface XTweetResponse {
  data: {
    public_metrics: {
      impression_count: number
      like_count: number
      reply_count: number
      retweet_count: number
      quote_count: number
    }
  }
}

export class XAnalyticsReader implements AnalyticsReaderPort {
  constructor(private readonly tokenVault: TokenVaultPort) {}

  async fetchPostMetrics(externalId: string, connection: OAuthConnection): Promise<PostMetrics> {
    const raw = await this.tokenVault.retrieve(connection.tokenRef)
    const token: XStoredToken = JSON.parse(raw)

    const response = await fetch(
      `${X_API}/tweets/${externalId}?tweet.fields=public_metrics`,
      { headers: { Authorization: `Bearer ${token.access_token}` } },
    )

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`X metrics fetch failed: ${response.status} ${err}`)
    }

    const data = (await response.json()) as XTweetResponse
    const metrics = data.data.public_metrics

    return {
      impressions: metrics.impression_count,
      likes: metrics.like_count,
      comments: metrics.reply_count,
      shares: metrics.retweet_count + metrics.quote_count,
    }
  }
}
