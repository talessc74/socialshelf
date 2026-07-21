import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MetaPublisher } from './MetaPublisher.js'
import { Platform } from '@socialshelf/domain'
import type { Post, OAuthConnection, TokenVaultPort } from '@socialshelf/domain'

function makePost(overrides: Partial<Post> = {}): Post {
  return {
    id: 'post-1',
    userId: 'user-1',
    brandId: 'brand-1',
    brandProfileVersion: null,
    content: [
      { platform: Platform.FACEBOOK, text: 'Hello Facebook!', charCount: 15 },
      { platform: Platform.INSTAGRAM, text: 'Hello Instagram!', charCount: 16 },
    ],
    imageStoragePaths: [],
    videoStoragePath: null,
    videoConsentAcceptedAt: null,
    status: 'scheduled',
    origin: 'manual',
    campaignId: null,
    scheduledAt: null,
    publishedAt: null,
    externalIds: {},
    sourceArticleUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function makeConnection(platform: Platform, tokenRef: string): OAuthConnection {
  return {
    id: `conn-${platform}`,
    userId: 'user-1',
    brandId: 'brand-1',
    platform,
    pairwiseId: `pairwise-${platform}`,
    tokenRef,
    scopes: [],
    expiresAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

const fbTokenJson = JSON.stringify({
  user_access_token: 'user-token',
  page_access_token: 'page-token-fb',
  page_id: 'page-999',
  page_name: 'Test Page',
  expires_at: new Date(Date.now() + 86400000).toISOString(),
})

const igTokenJson = JSON.stringify({
  user_access_token: 'user-token',
  page_access_token: 'page-token-ig',
  instagram_business_account_id: 'ig-biz-777',
  page_id: 'page-999',
  expires_at: new Date(Date.now() + 86400000).toISOString(),
})

describe('MetaPublisher', () => {
  let publisher: MetaPublisher
  let mockTokenVault: TokenVaultPort
  let fetchMock: ReturnType<typeof vi.fn>
  let resolveImageUrl: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    resolveImageUrl = vi.fn().mockImplementation((path: string) => Promise.resolve(`https://signed.example.com/${path}`))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('Facebook', () => {
    beforeEach(() => {
      mockTokenVault = {
        store: vi.fn(),
        retrieve: vi.fn().mockResolvedValue(fbTokenJson),
        delete: vi.fn(),
      }
      publisher = new MetaPublisher(mockTokenVault, resolveImageUrl)
    })

    it('posts to page feed and returns externalId when there are no images', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'page-999_post-111' }),
      })

      const result = await publisher.publish(makePost(), Platform.FACEBOOK, makeConnection(Platform.FACEBOOK, 'ref-fb'))

      expect(result.externalId).toBe('page-999_post-111')
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(fetchMock.mock.calls[0]![0]).toContain('/page-999/feed')
    })

    it('includes post text in request body', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'page-999_post-111' }),
      })

      await publisher.publish(makePost(), Platform.FACEBOOK, makeConnection(Platform.FACEBOOK, 'ref-fb'))

      const body = fetchMock.mock.calls[0]![1]!.body as string
      expect(new URLSearchParams(body).get('message')).toBe('Hello Facebook!')
    })

    it('posts a single image to /photos with the text as caption, returning the feed post_id', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'photo-222', post_id: 'page-999_post-333' }),
      })

      const storagePath = 'user-1/brand-1/cover.jpg'
      const post = makePost({ imageStoragePaths: [storagePath] })
      const result = await publisher.publish(post, Platform.FACEBOOK, makeConnection(Platform.FACEBOOK, 'ref-fb'))

      expect(result.externalId).toBe('page-999_post-333')
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(fetchMock.mock.calls[0]![0]).toContain('/page-999/photos')

      expect(resolveImageUrl).toHaveBeenCalledWith(storagePath)
      const params = new URLSearchParams(fetchMock.mock.calls[0]![1]!.body as string)
      expect(params.get('url')).toBe(`https://signed.example.com/${storagePath}`)
      expect(params.get('caption')).toBe('Hello Facebook!')
    })

    it('uploads each image unpublished then attaches all to one feed post when there are multiple images', async () => {
      fetchMock
        .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'photo-1' }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'photo-2' }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'page-999_post-444' }) })

      const post = makePost({ imageStoragePaths: ['user-1/brand-1/img1.jpg', 'user-1/brand-1/img2.jpg'] })
      const result = await publisher.publish(post, Platform.FACEBOOK, makeConnection(Platform.FACEBOOK, 'ref-fb'))

      expect(result.externalId).toBe('page-999_post-444')
      expect(fetchMock).toHaveBeenCalledTimes(3)
      expect(fetchMock.mock.calls[0]![0]).toContain('/page-999/photos')
      expect(fetchMock.mock.calls[1]![0]).toContain('/page-999/photos')
      expect(fetchMock.mock.calls[2]![0]).toContain('/page-999/feed')

      // Cada upload de foto deve ser não-publicado.
      expect(new URLSearchParams(fetchMock.mock.calls[0]![1]!.body as string).get('published')).toBe('false')

      // O post final anexa as duas fotos e leva a legenda.
      const feedParams = new URLSearchParams(fetchMock.mock.calls[2]![1]!.body as string)
      expect(feedParams.get('message')).toBe('Hello Facebook!')
      expect(feedParams.get('attached_media[0]')).toBe(JSON.stringify({ media_fbid: 'photo-1' }))
      expect(feedParams.get('attached_media[1]')).toBe(JSON.stringify({ media_fbid: 'photo-2' }))
    })

    it('throws when Graph API returns error', async () => {
      fetchMock.mockResolvedValueOnce({ ok: false, status: 400, text: async () => 'Bad Request' })

      await expect(
        publisher.publish(makePost(), Platform.FACEBOOK, makeConnection(Platform.FACEBOOK, 'ref-fb')),
      ).rejects.toThrow('Facebook publish failed')
    })

    it('translates an OAuth permission error (code 190) with the generic reconnect message — Pages have no personal/professional distinction, unlike Instagram', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => JSON.stringify({ error: { message: 'permission denied', type: 'OAuthException', code: 190 } }),
      })

      let thrown: Error | undefined
      try {
        await publisher.publish(makePost(), Platform.FACEBOOK, makeConnection(Platform.FACEBOOK, 'ref-fb'))
      } catch (err) {
        thrown = err as Error
      }

      expect(thrown?.message).toContain('reconecte a conta em Central de Contas')
      expect(thrown?.message).not.toContain('Business ou Creator')
    })
  })

  describe('Instagram', () => {
    beforeEach(() => {
      mockTokenVault = {
        store: vi.fn(),
        retrieve: vi.fn().mockResolvedValue(igTokenJson),
        delete: vi.fn(),
      }
      publisher = new MetaPublisher(mockTokenVault, resolveImageUrl)
    })

    it('throws when post has no images', async () => {
      await expect(
        publisher.publish(makePost(), Platform.INSTAGRAM, makeConnection(Platform.INSTAGRAM, 'ref-ig')),
      ).rejects.toThrow('Instagram requires at least one image')
    })

    it('creates container, waits until it is ready, then publishes and returns externalId', async () => {
      fetchMock
        .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'container-555' }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ status_code: 'FINISHED' }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'media-888' }) })

      const post = makePost({ imageStoragePaths: ['user-1/brand-1/img.jpg'] })
      const result = await publisher.publish(post, Platform.INSTAGRAM, makeConnection(Platform.INSTAGRAM, 'ref-ig'))

      expect(result.externalId).toBe('media-888')
      expect(fetchMock).toHaveBeenCalledTimes(3)
      expect(fetchMock.mock.calls[0]![0]).toContain('/ig-biz-777/media')
      expect(fetchMock.mock.calls[1]![0]).toContain('/container-555')
      expect(fetchMock.mock.calls[2]![0]).toContain('/ig-biz-777/media_publish')
    })

    it('retries media_publish on "Media ID is not available" (code 9007/2207027) even after the container reported FINISHED', async () => {
      vi.useFakeTimers()
      const mediaNotReadyBody = JSON.stringify({
        error: { message: 'Media ID is not available', code: 9007, error_subcode: 2207027 },
      })
      fetchMock
        .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'container-555' }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ status_code: 'FINISHED' }) })
        .mockResolvedValueOnce({ ok: false, status: 400, text: async () => mediaNotReadyBody })
        .mockResolvedValueOnce({ ok: false, status: 400, text: async () => mediaNotReadyBody })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'media-888' }) })

      const post = makePost({ imageStoragePaths: ['user-1/brand-1/img.jpg'] })
      const resultPromise = publisher.publish(post, Platform.INSTAGRAM, makeConnection(Platform.INSTAGRAM, 'ref-ig'))
      await vi.runAllTimersAsync()
      const result = await resultPromise

      expect(result.externalId).toBe('media-888')
      expect(fetchMock).toHaveBeenCalledTimes(5)
      vi.useRealTimers()
    })

    it('does not retry a permission/auth error from media_publish (not the "not ready" race)', async () => {
      fetchMock
        .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'container-555' }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ status_code: 'FINISHED' }) })
        .mockResolvedValueOnce({
          ok: false,
          status: 400,
          text: async () => JSON.stringify({ error: { message: 'permission denied', code: 190 } }),
        })

      const post = makePost({ imageStoragePaths: ['user-1/brand-1/img.jpg'] })

      await expect(
        publisher.publish(post, Platform.INSTAGRAM, makeConnection(Platform.INSTAGRAM, 'ref-ig')),
      ).rejects.toThrow('Instagram publish failed')
      expect(fetchMock).toHaveBeenCalledTimes(3)
    })

    it('translates a Graph API OAuth permission error (code 190) into an actionable message pointing at the professional-account requirement, not the raw JSON body', async () => {
      fetchMock
        .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'container-555' }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ status_code: 'FINISHED' }) })
        .mockResolvedValueOnce({
          ok: false,
          status: 400,
          text: async () =>
            JSON.stringify({
              error: {
                message:
                  "Any of the pages_read_engagement, pages_manage_metadata, pages_read_user_content, pages_manage_ads, pages_show_list or pages_messaging permission(s) must be granted before impersonating a user's page.",
                type: 'OAuthException',
                code: 190,
                fbtrace_id: 'AbCdEfGh123',
              },
            }),
        })

      const post = makePost({ imageStoragePaths: ['user-1/brand-1/img.jpg'] })

      let thrown: Error | undefined
      try {
        await publisher.publish(post, Platform.INSTAGRAM, makeConnection(Platform.INSTAGRAM, 'ref-ig'))
      } catch (err) {
        thrown = err as Error
      }

      expect(thrown?.message).toContain('conta é profissional (Business ou Creator')
      expect(thrown?.message).toContain('reconecte em Central de Contas')
      expect(thrown?.message).not.toContain('fbtrace_id')
      expect(thrown?.message).not.toContain('pages_read_engagement')
    })

    it('resolves the storage path into a signed URL before sending it to the Graph API', async () => {
      fetchMock
        .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'container-555' }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ status_code: 'FINISHED' }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'media-888' }) })

      const storagePath = 'user-1/brand-1/photo.jpg'
      const post = makePost({ imageStoragePaths: [storagePath] })
      await publisher.publish(post, Platform.INSTAGRAM, makeConnection(Platform.INSTAGRAM, 'ref-ig'))

      expect(resolveImageUrl).toHaveBeenCalledWith(storagePath)
      const containerBody = fetchMock.mock.calls[0]![1]!.body as string
      expect(containerBody).toContain(encodeURIComponent(`https://signed.example.com/${storagePath}`))
    })

    it('throws when the container fails to process', async () => {
      fetchMock
        .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'container-555' }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ status_code: 'ERROR' }) })

      const post = makePost({ imageStoragePaths: ['user-1/brand-1/img.jpg'] })

      await expect(
        publisher.publish(post, Platform.INSTAGRAM, makeConnection(Platform.INSTAGRAM, 'ref-ig')),
      ).rejects.toThrow('failed to process')
    })

    it('creates one item container per image plus a carousel container when there are multiple images', async () => {
      fetchMock
        .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'child-1' }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ status_code: 'FINISHED' }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'child-2' }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ status_code: 'FINISHED' }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'carousel-999' }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ status_code: 'FINISHED' }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'media-888' }) })

      const post = makePost({ imageStoragePaths: ['user-1/brand-1/img1.jpg', 'user-1/brand-1/img2.jpg'] })
      const result = await publisher.publish(post, Platform.INSTAGRAM, makeConnection(Platform.INSTAGRAM, 'ref-ig'))

      expect(result.externalId).toBe('media-888')
      expect(fetchMock).toHaveBeenCalledTimes(7)

      const child1Body = fetchMock.mock.calls[0]![1]!.body as string
      expect(new URLSearchParams(child1Body).get('is_carousel_item')).toBe('true')

      const carouselBody = fetchMock.mock.calls[4]![1]!.body as string
      const carouselParams = new URLSearchParams(carouselBody)
      expect(carouselParams.get('media_type')).toBe('CAROUSEL')
      expect(carouselParams.get('children')).toBe('child-1,child-2')

      expect(fetchMock.mock.calls[6]![0]).toContain('/ig-biz-777/media_publish')
    })
  })

  // Conexão feita pelo "Login do Instagram" (sem Facebook — _local-edr-policy-057): o vault
  // guarda auth_kind: 'instagram_login' com o token da própria conta, e a publicação fala com
  // graph.instagram.com em vez de graph.facebook.com.
  describe('Instagram (Login do Instagram, sem Facebook)', () => {
    const igLoginTokenJson = JSON.stringify({
      auth_kind: 'instagram_login',
      access_token: 'ig-user-token',
      instagram_user_id: 'ig-user-123',
      username: 'contadireta',
      expires_at: new Date(Date.now() + 86400000).toISOString(),
    })

    beforeEach(() => {
      mockTokenVault = {
        store: vi.fn(),
        retrieve: vi.fn().mockResolvedValue(igLoginTokenJson),
        delete: vi.fn(),
      }
      publisher = new MetaPublisher(mockTokenVault, resolveImageUrl)
    })

    it('publishes via graph.instagram.com using the account token directly', async () => {
      fetchMock
        .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'container-1' }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ status_code: 'FINISHED' }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'media-42' }) })

      const post = makePost({ imageStoragePaths: ['user-1/brand-1/img.jpg'] })
      const result = await publisher.publish(post, Platform.INSTAGRAM, makeConnection(Platform.INSTAGRAM, 'ref-ig'))

      expect(result.externalId).toBe('media-42')
      for (const call of fetchMock.mock.calls) {
        expect(call[0]).toContain('graph.instagram.com')
        expect(call[0]).not.toContain('graph.facebook.com')
      }
      expect(fetchMock.mock.calls[0]![0]).toContain('/ig-user-123/media')
      const containerBody = fetchMock.mock.calls[0]![1]!.body as string
      expect(new URLSearchParams(containerBody).get('access_token')).toBe('ig-user-token')
      expect(fetchMock.mock.calls[2]![0]).toContain('/ig-user-123/media_publish')
    })

    it('publishes a carousel via graph.instagram.com', async () => {
      fetchMock
        .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'child-1' }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ status_code: 'FINISHED' }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'child-2' }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ status_code: 'FINISHED' }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'carousel-9' }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ status_code: 'FINISHED' }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'media-77' }) })

      const post = makePost({ imageStoragePaths: ['a.jpg', 'b.jpg'] })
      const result = await publisher.publish(post, Platform.INSTAGRAM, makeConnection(Platform.INSTAGRAM, 'ref-ig'))

      expect(result.externalId).toBe('media-77')
      for (const call of fetchMock.mock.calls) {
        expect(call[0]).toContain('graph.instagram.com')
      }
    })
  })
})
