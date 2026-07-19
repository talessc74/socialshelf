import { Platform } from '@socialshelf/domain'
import type { PublisherPort, PublishResult, Post, OAuthConnection, TokenVaultPort } from '@socialshelf/domain'

const GRAPH = 'https://graph.facebook.com/v21.0'
// Host do "Login do Instagram" (conexão direta, sem Facebook — _local-edr-policy-057). Os
// endpoints de publicação (/media, /media_publish, status_code) têm o mesmo formato do
// graph.facebook.com; muda o host e o token (o da própria conta, não o page_access_token).
const IG_GRAPH = 'https://graph.instagram.com/v21.0'
const CONTAINER_POLL_INTERVAL_MS = 2000
const CONTAINER_POLL_MAX_ATTEMPTS = 30

interface FacebookToken {
  page_access_token: string
  page_id: string
}

// Dois formatos convivem no vault para o Instagram: o legado via Facebook Login
// (page_access_token + instagram_business_account_id) e o do Login do Instagram
// (auth_kind: 'instagram_login', access_token + instagram_user_id).
interface InstagramToken {
  auth_kind?: string
  page_access_token?: string
  instagram_business_account_id?: string
  access_token?: string
  instagram_user_id?: string
}

interface InstagramAuth {
  graphBase: string
  igAccountId: string
  accessToken: string
}

function resolveInstagramAuth(raw: string): InstagramAuth {
  const token: InstagramToken = JSON.parse(raw)
  if (token.auth_kind === 'instagram_login') {
    return {
      graphBase: IG_GRAPH,
      igAccountId: token.instagram_user_id ?? '',
      accessToken: token.access_token ?? '',
    }
  }
  return {
    graphBase: GRAPH,
    igAccountId: token.instagram_business_account_id ?? '',
    accessToken: token.page_access_token ?? '',
  }
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

    // Sem imagem: post de texto puro no feed (comportamento original).
    if (post.imageStoragePaths.length === 0) {
      return this.publishFacebookText(token, text)
    }

    // Uma imagem: post de foto única já publicado, com a legenda no próprio /photos.
    if (post.imageStoragePaths.length === 1) {
      return this.publishFacebookSinglePhoto(token, post.imageStoragePaths[0]!, text)
    }

    // Várias imagens: sobe cada foto como não-publicada e anexa todas a um único post de feed.
    return this.publishFacebookMultiPhoto(token, post.imageStoragePaths, text)
  }

  private async publishFacebookText(token: FacebookToken, text: string): Promise<PublishResult> {
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

  private async publishFacebookSinglePhoto(
    token: FacebookToken,
    imagePath: string,
    caption: string,
  ): Promise<PublishResult> {
    const imageUrl = await this.resolveImageUrl(imagePath)
    const params = new URLSearchParams({
      url: imageUrl,
      caption,
      access_token: token.page_access_token,
    })

    const response = await fetch(`${GRAPH}/${token.page_id}/photos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    })

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`Facebook publish failed: ${response.status} ${err}`)
    }

    // /photos devolve { id, post_id }: post_id é o post no feed; id é só a foto. Preferimos o post_id.
    const data = (await response.json()) as { id: string; post_id?: string }
    return { externalId: data.post_id ?? data.id, publishedAt: new Date() }
  }

  private async publishFacebookMultiPhoto(
    token: FacebookToken,
    imagePaths: string[],
    text: string,
  ): Promise<PublishResult> {
    const mediaFbids: string[] = []
    for (const imagePath of imagePaths) {
      mediaFbids.push(await this.uploadUnpublishedPhoto(token, imagePath))
    }

    const params = new URLSearchParams({
      message: text,
      access_token: token.page_access_token,
    })
    // attached_media[n]={"media_fbid":"<id>"} liga cada foto não-publicada ao post de feed.
    mediaFbids.forEach((fbid, i) => {
      params.append(`attached_media[${i}]`, JSON.stringify({ media_fbid: fbid }))
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

  private async uploadUnpublishedPhoto(token: FacebookToken, imagePath: string): Promise<string> {
    const imageUrl = await this.resolveImageUrl(imagePath)
    const params = new URLSearchParams({
      url: imageUrl,
      // published=false: a foto é carregada mas não vira post — só será exibida quando anexada ao feed.
      published: 'false',
      access_token: token.page_access_token,
    })

    const response = await fetch(`${GRAPH}/${token.page_id}/photos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    })

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`Facebook photo upload failed: ${response.status} ${err}`)
    }

    const { id } = (await response.json()) as { id: string }
    return id
  }

  private async publishInstagram(post: Post, connection: OAuthConnection): Promise<PublishResult> {
    if (post.imageStoragePaths.length === 0) {
      throw new Error('Instagram requires at least one image')
    }

    const raw = await this.tokenVault.retrieve(connection.tokenRef)
    const auth = resolveInstagramAuth(raw)

    const caption = post.content.find((c) => c.platform === Platform.INSTAGRAM)?.text ?? ''

    // Step 1: create media container — a single image, or a carousel of children containers.
    const containerId =
      post.imageStoragePaths.length === 1
        ? await this.createImageContainer(auth, post.imageStoragePaths[0]!, caption)
        : await this.createCarouselContainer(auth, post.imageStoragePaths, caption)

    // Meta processes containers asynchronously (downloads the image_url); publishing before
    // it's FINISHED fails with "Media ID is not available" (code 9007 / subcode 2207027).
    await this.waitUntilContainerReady(auth, containerId)

    // Step 2: publish container
    const publishParams = new URLSearchParams({
      creation_id: containerId,
      access_token: auth.accessToken,
    })

    const publishRes = await fetch(`${auth.graphBase}/${auth.igAccountId}/media_publish`, {
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
    auth: InstagramAuth,
    imagePath: string,
    caption: string,
  ): Promise<string> {
    const imageUrl = await this.resolveImageUrl(imagePath)
    const params = new URLSearchParams({ image_url: imageUrl, caption, access_token: auth.accessToken })

    const res = await fetch(`${auth.graphBase}/${auth.igAccountId}/media`, {
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
    auth: InstagramAuth,
    imagePaths: string[],
    caption: string,
  ): Promise<string> {
    const childIds: string[] = []
    for (const imagePath of imagePaths) {
      const imageUrl = await this.resolveImageUrl(imagePath)
      const params = new URLSearchParams({
        image_url: imageUrl,
        is_carousel_item: 'true',
        access_token: auth.accessToken,
      })

      const res = await fetch(`${auth.graphBase}/${auth.igAccountId}/media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      })

      if (!res.ok) {
        const err = await res.text()
        throw new Error(`Instagram carousel item container failed: ${res.status} ${err}`)
      }

      const { id } = (await res.json()) as { id: string }
      await this.waitUntilContainerReady(auth, id)
      childIds.push(id)
    }

    const params = new URLSearchParams({
      media_type: 'CAROUSEL',
      caption,
      children: childIds.join(','),
      access_token: auth.accessToken,
    })

    const res = await fetch(`${auth.graphBase}/${auth.igAccountId}/media`, {
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

  private async waitUntilContainerReady(auth: InstagramAuth, containerId: string): Promise<void> {
    for (let attempt = 0; attempt < CONTAINER_POLL_MAX_ATTEMPTS; attempt++) {
      const res = await fetch(`${auth.graphBase}/${containerId}?fields=status_code&access_token=${auth.accessToken}`)

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
