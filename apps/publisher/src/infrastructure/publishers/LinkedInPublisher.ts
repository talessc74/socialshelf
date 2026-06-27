import { Platform } from '@socialshelf/domain'
import type { PublisherPort, PublishResult, Post, OAuthConnection, TokenVaultPort } from '@socialshelf/domain'

const LI_REST = 'https://api.linkedin.com/rest'
const LI_USERINFO = 'https://api.linkedin.com/v2/userinfo'
// Lançada em fev/2026 — sunset estimado fev/2027 (suporte mínimo de 12 meses garantido pela LinkedIn)
const LI_VERSION = '202602'

interface LinkedInToken {
  access_token: string
}

export class LinkedInPublisher implements PublisherPort {
  constructor(
    private readonly tokenVault: TokenVaultPort,
    private readonly resolveImageUrl: (path: string) => Promise<string>,
  ) {}

  async publish(post: Post, platform: Platform, connection: OAuthConnection): Promise<PublishResult> {
    const raw = await this.tokenVault.retrieve(connection.tokenRef)
    const token: LinkedInToken = JSON.parse(raw)
    const accessToken = token.access_token

    const text = post.content.find((c) => c.platform === Platform.LINKEDIN)?.text ?? ''
    const author = connection.organizationUrn ?? `urn:li:person:${await this.getPersonId(accessToken)}`

    // Cada imagem precisa ser registrada como URN na Images API antes de poder ser referenciada
    // no corpo do post — o /rest/posts não aceita upload de bytes inline.
    const imageUrns: string[] = []
    for (const path of post.imageStoragePaths) {
      imageUrns.push(await this.uploadImage(accessToken, author, path))
    }

    const body: Record<string, unknown> = {
      author,
      commentary: text,
      visibility: 'PUBLIC',
      distribution: {
        feedDistribution: 'MAIN_FEED',
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      lifecycleState: 'PUBLISHED',
      isReshareDisabledByAuthor: false,
    }

    // Uma imagem → content.media; várias → content.multiImage. Sem imagem mantém texto puro.
    if (imageUrns.length === 1) {
      body['content'] = { media: { id: imageUrns[0] } }
    } else if (imageUrns.length > 1) {
      body['content'] = { multiImage: { images: imageUrns.map((id) => ({ id })) } }
    }

    const response = await fetch(`${LI_REST}/posts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'LinkedIn-Version': LI_VERSION,
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`LinkedIn publish failed: ${response.status} ${err}`)
    }

    // New REST API returns the post URN in the x-restli-id response header
    const postUrn = response.headers.get('x-restli-id') ?? response.headers.get('location') ?? 'unknown'
    return { externalId: postUrn, publishedAt: new Date() }
  }

  // Images API em 3 passos: initializeUpload devolve a uploadUrl e o URN da imagem;
  // sobe-se os bytes para a uploadUrl; o URN é então referenciado no corpo do post.
  private async uploadImage(accessToken: string, owner: string, path: string): Promise<string> {
    const initRes = await fetch(`${LI_REST}/images?action=initializeUpload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'LinkedIn-Version': LI_VERSION,
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify({ initializeUploadRequest: { owner } }),
    })

    if (!initRes.ok) {
      const err = await initRes.text()
      throw new Error(`LinkedIn image init failed: ${initRes.status} ${err}`)
    }

    const initData = (await initRes.json()) as { value: { uploadUrl: string; image: string } }
    const { uploadUrl, image } = initData.value

    const imageUrl = await this.resolveImageUrl(path)
    const imgRes = await fetch(imageUrl)
    if (!imgRes.ok) {
      throw new Error(`LinkedIn image fetch failed: ${imgRes.status}`)
    }
    const bytes = await imgRes.arrayBuffer()

    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: bytes,
    })

    if (!uploadRes.ok) {
      const err = await uploadRes.text()
      throw new Error(`LinkedIn image upload failed: ${uploadRes.status} ${err}`)
    }

    return image
  }

  private async getPersonId(accessToken: string): Promise<string> {
    const response = await fetch(LI_USERINFO, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!response.ok) {
      throw new Error(`LinkedIn /userinfo failed: ${response.status}`)
    }

    const data = (await response.json()) as { sub: string }
    return data.sub
  }
}
