import { Platform } from '@socialshelf/domain'
import type { PublisherPort, PublishResult, Post, OAuthConnection, TokenVaultPort } from '@socialshelf/domain'

const GRAPH = 'https://graph.facebook.com/v21.0'

interface FacebookToken {
  page_access_token: string
  page_id: string
}

interface InstagramToken {
  page_access_token: string
  instagram_business_account_id: string
}

export class MetaPublisher implements PublisherPort {
  constructor(
    private readonly tokenVault: TokenVaultPort,
    private readonly resolveImageUrl: (path: string) => Promise<string>,
  ) {}

  async publish(post: Post, platform: Platform, connection: OAuthConnection): Promise<PublishResult> {
    if (platform === Platform.FACEBOOK) {
      return this.publishFacebook(post, connection)
    }
    if (platform === Platform.INSTAGRAM) {
      return this.publishInstagram(post, connection)
    }
    throw new Error(`MetaPublisher does not support platform: ${platform}`)
  }

  private async publishFacebook(post: Post, connection: OAuthConnection): Promise<PublishResult> {
    const raw = await this.tokenVault.retrieve(connection.tokenRef)
    const token: FacebookToken = JSON.parse(raw)

    const text = post.content.find((c) => c.platform === Platform.FACEBOOK)?.text ?? ''

    const params = new URLSearchParams({
      message: text,
      access_token: token.page_access_token,
    })

    const response = await fetch(`${GRAPH}/${token.page_id}/feed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    })

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`Facebook publish failed: ${response.status} ${err}`)
    }

    const data = (await response.json()) as { id: string }
    return { externalId: data.id, publishedAt: new Date() }
  }

  private async publishInstagram(post: Post, connection: OAuthConnection): Promise<PublishResult> {
    if (post.imageStoragePaths.length === 0) {
      throw new Error('Instagram requires at least one image')
    }

    const raw = await this.tokenVault.retrieve(connection.tokenRef)
    const token: InstagramToken = JSON.parse(raw)
    const igAccountId = token.instagram_business_account_id

    const caption = post.content.find((c) => c.platform === Platform.INSTAGRAM)?.text ?? ''
    const imageUrl = await this.resolveImageUrl(post.imageStoragePaths[0]!)

    // Step 1: create media container
    const containerParams = new URLSearchParams({
      image_url: imageUrl,
      caption,
      access_token: token.page_access_token,
    })

    const containerRes = await fetch(`${GRAPH}/${igAccountId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: containerParams.toString(),
    })

    if (!containerRes.ok) {
      const err = await containerRes.text()
      throw new Error(`Instagram media container failed: ${containerRes.status} ${err}`)
    }

    const { id: containerId } = (await containerRes.json()) as { id: string }

    // Step 2: publish container
    const publishParams = new URLSearchParams({
      creation_id: containerId,
      access_token: token.page_access_token,
    })

    const publishRes = await fetch(`${GRAPH}/${igAccountId}/media_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: publishParams.toString(),
    })

    if (!publishRes.ok) {
      const err = await publishRes.text()
      throw new Error(`Instagram publish failed: ${publishRes.status} ${err}`)
    }

    const { id: mediaId } = (await publishRes.json()) as { id: string }
    return { externalId: mediaId, publishedAt: new Date() }
  }
}
