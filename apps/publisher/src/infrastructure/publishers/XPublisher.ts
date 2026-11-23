import { Platform } from '@socialshelf/domain'
import type { PublisherPort, PublishResult, Post, OAuthConnection, TokenVaultPort } from '@socialshelf/domain'
import { refreshXToken } from '../../lib/x-refresh.js'

const X_API = 'https://api.twitter.com/2'

interface XStoredToken {
  access_token: string
  refresh_token?: string | null
  expires_at?: string | null
  scope?: string
}

export class XPublisher implements PublisherPort {
  constructor(private readonly tokenVault: TokenVaultPort) {}

  async publish(post: Post, _platform: Platform, connection: OAuthConnection): Promise<PublishResult> {
    const raw = await this.tokenVault.retrieve(connection.tokenRef)
    let token: XStoredToken = JSON.parse(raw)

    const text = post.content.find((c) => c.platform === Platform.TWITTER)?.text ?? ''

    const attempt = await this.postTweet(token.access_token, text)

    if (attempt.status === 402) {
      throw new Error('Publicação no X (Twitter) requer plano pago na API do X Developer. Funcionalidade temporariamente indisponível.')
    }

    if (attempt.status === 401 && token.refresh_token) {
      const refreshed = await refreshXToken(token.refresh_token)
      const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000)
      token = {
        access_token: refreshed.access_token,
        refresh_token: refreshed.refresh_token ?? token.refresh_token,
        expires_at: newExpiresAt.toISOString(),
        scope: refreshed.scope,
      }
      await this.tokenVault.store(connection.tokenRef, JSON.stringify(token))

      const retry = await this.postTweet(token.access_token, text)
      if (retry.status === 402) {
        throw new Error('Publicação no X (Twitter) requer plano pago na API do X Developer. Funcionalidade temporariamente indisponível.')
      }
      if (!retry.ok) {
        const err = await retry.text()
        throw new Error(`X publish failed after token refresh: ${retry.status} ${err}`)
      }
      const retryData = (await retry.json()) as { data: { id: string } }
      return { externalId: retryData.data.id, publishedAt: new Date() }
    }

    if (!attempt.ok) {
      const err = await attempt.text()
      throw new Error(`X publish failed: ${attempt.status} ${err}`)
    }

    const data = (await attempt.json()) as { data: { id: string } }
    return { externalId: data.data.id, publishedAt: new Date() }
  }

  private postTweet(accessToken: string, text: string): Promise<Response> {
    return fetch(`${X_API}/tweets`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    })
  }
}
