import { Platform } from '@socialshelf/domain'
import type { PublisherPort, PublishResult, Post, OAuthConnection, TokenVaultPort } from '@socialshelf/domain'

const GRAPH = 'https://graph.facebook.com/v21.0'
const CONTAINER_POLL_INTERVAL_MS = 2000
const CONTAINER_POLL_MAX_ATTEMPTS = 30

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
    const accessToken = token.page_access_token

    const caption = post.content.find((c) => c.platform === Platform.INSTAGRAM)?.text ?? ''

    // Step 1: create media container — a single image, or a carousel of children containers.
    const containerId =
      post.imageStoragePaths.length === 1
        ? await this.createImageContainer(igAccountId, post.imageStoragePaths[0]!, caption, accessToken)
        : await this.createCarouselContainer(igAccountId, post.imageStoragePaths, caption, accessToken)

    // Meta processes containers asynchronously (downloads the image_url); publishing before
    // it's FINISHED fails with "Media ID is not available" (code 9007 / subcode 2207027).
    await this.waitUntilContainerReady(containerId, accessToken)

    // Step 2: publish container
    const publishParams = new URLSearchParams({
      creation_id: containerId,
      access_token: accessToken,
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

  private async createImageContainer(
    igAccountId: string,
    imagePath: string,
    caption: string,
    accessToken: string,
  ): Promise<string> {
    const imageUrl = await this.resolveImageUrl(imagePath)
    const params = new URLSearchParams({ image_url: imageUrl, caption, access_token: accessToken })

    const res = await fetch(`${GRAPH}/${igAccountId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Instagram media container failed: ${res.status} ${err}`)
    }

    const { id } = (await res.json()) as { id: string }
    return id
  }

  private async createCarouselContainer(
    igAccountId: string,
    imagePaths: string[],
    caption: string,
    accessToken: string,
  ): Promise<string> {
    const childIds: string[] = []
    for (const imagePath of imagePaths) {
      const imageUrl = await this.resolveImageUrl(imagePath)
      const params = new URLSearchParams({
        image_url: imageUrl,
        is_carousel_item: 'true',
        access_token: accessToken,
      })

      const res = await fetch(`${GRAPH}/${igAccountId}/media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      })

      if (!res.ok) {
        const err = await res.text()
        throw new Error(`Instagram carousel item container failed: ${res.status} ${err}`)
      }

      const { id } = (await res.json()) as { id: string }
      await this.waitUntilContainerReady(id, accessToken)
      childIds.push(id)
    }

    const params = new URLSearchParams({
      media_type: 'CAROUSEL',
      caption,
      children: childIds.join(','),
      access_token: accessToken,
    })

    const res = await fetch(`${GRAPH}/${igAccountId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Instagram carousel container failed: ${res.status} ${err}`)
    }

    const { id } = (await res.json()) as { id: string }
    return id
  }

  private async waitUntilContainerReady(containerId: string, accessToken: string): Promise<void> {
    for (let attempt = 0; attempt < CONTAINER_POLL_MAX_ATTEMPTS; attempt++) {
      const res = await fetch(`${GRAPH}/${containerId}?fields=status_code&access_token=${accessToken}`)

      if (!res.ok) {
        const err = await res.text()
        throw new Error(`Instagram container status check failed: ${res.status} ${err}`)
      }

      const { status_code: statusCode } = (await res.json()) as { status_code: string }
      if (statusCode === 'FINISHED') return
      if (statusCode === 'ERROR' || statusCode === 'EXPIRED') {
        throw new Error(`Instagram container ${containerId} failed to process: ${statusCode}`)
      }

      await new Promise((resolve) => setTimeout(resolve, CONTAINER_POLL_INTERVAL_MS))
    }

    throw new Error(`Instagram container ${containerId} did not finish processing in time`)
  }
}
