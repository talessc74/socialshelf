import { Platform } from '@socialshelf/domain'
import type { PublisherPort, PublishResult, Post, OAuthConnection, TokenVaultPort } from '@socialshelf/domain'

const X_API = 'https://api.twitter.com/2'

interface XStoredToken {
  access_token: string
  refresh_token?: string | null
  expires_at?: string | null
  scope?: string
}

async function refreshXToken(refreshToken: string): Promise<{ access_token: string; refresh_token?: string; expires_in: number; scope: string }> {
  const clientId = process.env['X_CLIENT_ID'] ?? ''
  const clientSecret = process.env['X_CLIENT_SECRET'] ?? ''
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  })

  const response = await fetch('https://api.twitter.com/2/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: body.toString(),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`X token refresh failed: ${response.status} ${text}`)
  }

  return response.json() as Promise<{ access_token: string; refresh_token?: string; expires_in: number; scope: string }>
}

export class XPublisher implements PublisherPort {
  constructor(private readonly tokenVault: TokenVaultPort) {}

  async publish(post: Post, _platform: Platform, connection: OAuthConnection): Promise<PublishResult> {
    const raw = await this.tokenVault.retrieve(connection.tokenRef)
    let token: XStoredToken = JSON.parse(raw)

    const text = post.content.find((c) => c.platform === Platform.TWITTER)?.text ?? ''

    const attempt = await this.postTweet(token.access_token, text)

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
