import type { AnalyticsReaderPort, PostMetrics, OAuthConnection, TokenVaultPort } from '@socialshelf/domain'
import { refreshXToken } from '../../lib/x-refresh.js'

const X_API = 'https://api.twitter.com/2'

interface XStoredToken {
  access_token: string
  refresh_token?: string | null
  expires_at?: string | null
  scope?: string
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
    let token: XStoredToken = JSON.parse(raw)

    let response = await this.getTweet(externalId, token.access_token)

    // Mesmo padrão reativo de XPublisher (_local-adr-policy-016, emenda 2026-11-22): sem isso,
    // o dashboard de Performance mostrava o erro de token expirado em vez de reconectar sozinho.
    if (response.status === 401 && token.refresh_token) {
      const refreshed = await refreshXToken(token.refresh_token)
      const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000)
      token = {
        access_token: refreshed.access_token,
        refresh_token: refreshed.refresh_token ?? token.refresh_token,
        expires_at: newExpiresAt.toISOString(),
        scope: refreshed.scope,
      }
      await this.tokenVault.store(connection.tokenRef, JSON.stringify(token))
      response = await this.getTweet(externalId, token.access_token)
    }

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

  private getTweet(externalId: string, accessToken: string): Promise<Response> {
    return fetch(`${X_API}/tweets/${externalId}?tweet.fields=public_metrics`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
  }
}
