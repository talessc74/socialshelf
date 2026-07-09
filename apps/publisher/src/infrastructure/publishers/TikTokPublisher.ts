import { Platform } from '@socialshelf/domain'
import type { PublisherPort, PublishResult, Post, OAuthConnection, TokenVaultPort } from '@socialshelf/domain'

const TIKTOK_API = 'https://open.tiktokapis.com/v2'
const STATUS_POLL_INTERVAL_MS = 3000
const STATUS_POLL_MAX_ATTEMPTS = 30

interface TikTokStoredToken {
  access_token: string
  refresh_token: string
  expires_at?: string | null
  open_id?: string | undefined
  scope?: string | undefined
}

interface InitResponse {
  data: { publish_id: string }
  error: { code: string; message: string }
}

interface StatusResponse {
  data: { status: string }
  error: { code: string; message: string }
}

async function refreshTikTokToken(
  refreshToken: string,
): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  const clientKey = process.env['TIKTOK_CLIENT_KEY'] ?? ''
  const clientSecret = process.env['TIKTOK_CLIENT_SECRET'] ?? ''

  const body = new URLSearchParams({
    client_key: clientKey,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  })

  const response = await fetch(`${TIKTOK_API}/oauth/token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`TikTok token refresh failed: ${response.status} ${text}`)
  }

  return response.json() as Promise<{ access_token: string; refresh_token: string; expires_in: number }>
}

export class TikTokPublisher implements PublisherPort {
  constructor(
    private readonly tokenVault: TokenVaultPort,
    private readonly resolveVideoUrl: (path: string) => Promise<string>,
  ) {}

  async publish(post: Post, _platform: Platform, connection: OAuthConnection): Promise<PublishResult> {
    if (!post.videoStoragePath) {
      throw new Error('TikTok requires a video (post.videoStoragePath is missing)')
    }

    const raw = await this.tokenVault.retrieve(connection.tokenRef)
    let token: TikTokStoredToken = JSON.parse(raw)

    const title = post.content.find((c) => c.platform === Platform.TIKTOK)?.text ?? ''
    const videoUrl = await this.resolveVideoUrl(post.videoStoragePath)

    let initRes = await this.initPublish(token.access_token, title, videoUrl)

    if (initRes.status === 401) {
      const refreshed = await refreshTikTokToken(token.refresh_token)
      token = {
        access_token: refreshed.access_token,
        refresh_token: refreshed.refresh_token,
        expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
        open_id: token.open_id,
        scope: token.scope,
      }
      await this.tokenVault.store(connection.tokenRef, JSON.stringify(token))
      initRes = await this.initPublish(token.access_token, title, videoUrl)
    }

    if (!initRes.ok) {
      const err = await initRes.text()
      throw new Error(`TikTok publish init failed: ${initRes.status} ${err}`)
    }

    const initBody = (await initRes.json()) as InitResponse
    const publishId = initBody.data.publish_id

    await this.waitUntilPublishComplete(token.access_token, publishId)

    return { externalId: publishId, publishedAt: new Date() }
  }

  private initPublish(accessToken: string, title: string, videoUrl: string): Promise<Response> {
    return fetch(`${TIKTOK_API}/post/publish/video/init/`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        post_info: {
          title,
          // SELF_ONLY (privado, visível só para o autor) é o único privacy_level aceito
          // por apps que ainda não passaram pela revisão de app da TikTok — publicar como
          // público falha até o app estar aprovado em Production (ver _local-adr-policy-034).
          privacy_level: 'SELF_ONLY',
          disable_duet: false,
          disable_comment: false,
          disable_stitch: false,
        },
        source_info: {
          source: 'PULL_FROM_URL',
          video_url: videoUrl,
        },
      }),
    })
  }

  private async waitUntilPublishComplete(accessToken: string, publishId: string): Promise<void> {
    for (let attempt = 0; attempt < STATUS_POLL_MAX_ATTEMPTS; attempt++) {
      const res = await fetch(`${TIKTOK_API}/post/publish/status/fetch/`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ publish_id: publishId }),
      })

      if (!res.ok) {
        const err = await res.text()
        throw new Error(`TikTok status check failed: ${res.status} ${err}`)
      }

      const body = (await res.json()) as StatusResponse
      const status = body.data.status

      if (status === 'PUBLISH_COMPLETE') return
      if (status === 'FAILED') {
        throw new Error(`TikTok publish ${publishId} failed: ${body.error?.message ?? 'unknown error'}`)
      }

      await new Promise((resolve) => setTimeout(resolve, STATUS_POLL_INTERVAL_MS))
    }

    throw new Error(`TikTok publish ${publishId} did not complete in time`)
  }
}
