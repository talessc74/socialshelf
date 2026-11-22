import { Platform } from '@socialshelf/domain'
import type { PublisherPort, PublishResult, Post, OAuthConnection, TokenVaultPort } from '@socialshelf/domain'
import { refreshLinkedInToken } from '../../lib/linkedin-refresh.js'

const LI_REST = 'https://api.linkedin.com/rest'
const LI_USERINFO = 'https://api.linkedin.com/v2/userinfo'
// Lançada em fev/2026 — sunset estimado fev/2027 (suporte mínimo de 12 meses garantido pela LinkedIn)
const LI_VERSION = '202602'

interface LinkedInToken {
  access_token: string
  refresh_token?: string | null
}

export class LinkedInPublisher implements PublisherPort {
  constructor(
    private readonly tokenVault: TokenVaultPort,
    private readonly resolveImageUrl: (path: string) => Promise<string>,
  ) {}

  async publish(post: Post, platform: Platform, connection: OAuthConnection): Promise<PublishResult> {
    const raw = await this.tokenVault.retrieve(connection.tokenRef)
    let token: LinkedInToken = JSON.parse(raw)

    // Refresh proativo antes de qualquer chamada: o fluxo de publicação faz várias chamadas
    // encadeadas (getPersonId, upload de imagem em 3 passos, criação do post) — um 401 a meio
    // do upload de imagens forçaria re-subir tudo de novo. connection.expiresAt já diz se o
    // access_token (60 dias) está vencido; refresh_token (90 dias) sobrevive bem além disso
    // (_local-adr-policy-016, emenda 2026-11-22: nunca usado até aqui, embora já gravado no
    // vault desde a conexão inicial).
    if (connection.expiresAt && connection.expiresAt.getTime() <= Date.now() && token.refresh_token) {
      token = await this.refreshAndStore(connection.tokenRef, token.refresh_token)
    }

    const text = post.content.find((c) => c.platform === Platform.LINKEDIN)?.text ?? ''
    const author = connection.organizationUrn ?? `urn:li:person:${await this.getPersonId(token.access_token)}`

    // Cada imagem precisa ser registrada como URN na Images API antes de poder ser referenciada
    // no corpo do post — o /rest/posts não aceita upload de bytes inline.
    const imageUrns: string[] = []
    for (const path of post.imageStoragePaths) {
      imageUrns.push(await this.uploadImage(token.access_token, author, path))
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

    let response = await this.createPost(token.access_token, body)

    // Defesa adicional além do refresh proativo acima (ex.: expiresAt desatualizado/drift) —
    // só re-tenta a criação do post, sem re-subir imagens já enviadas.
    if (response.status === 401 && token.refresh_token) {
      token = await this.refreshAndStore(connection.tokenRef, token.refresh_token)
      response = await this.createPost(token.access_token, body)
    }

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`LinkedIn publish failed: ${response.status} ${err}`)
    }

    // New REST API returns the post URN in the x-restli-id response header
    const postUrn = response.headers.get('x-restli-id') ?? response.headers.get('location') ?? 'unknown'
    return { externalId: postUrn, publishedAt: new Date() }
  }

  private async refreshAndStore(tokenRef: string, refreshToken: string): Promise<LinkedInToken> {
    const refreshed = await refreshLinkedInToken(refreshToken)
    const token: LinkedInToken = {
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token ?? refreshToken,
    }
    await this.tokenVault.store(tokenRef, JSON.stringify(token))
    return token
  }

  private createPost(accessToken: string, body: Record<string, unknown>): Promise<Response> {
    return fetch(`${LI_REST}/posts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'LinkedIn-Version': LI_VERSION,
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify(body),
    })
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
