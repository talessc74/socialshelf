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
    status: 'scheduled',
    scheduledAt: null,
    publishedAt: null,
    externalIds: {},
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

    it('posts to page feed and returns externalId', async () => {
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

    it('throws when Graph API returns error', async () => {
      fetchMock.mockResolvedValueOnce({ ok: false, status: 400, text: async () => 'Bad Request' })

      await expect(
        publisher.publish(makePost(), Platform.FACEBOOK, makeConnection(Platform.FACEBOOK, 'ref-fb')),
      ).rejects.toThrow('Facebook publish failed')
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

    it('creates container then publishes and returns externalId', async () => {
      fetchMock
        .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'container-555' }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'media-888' }) })

      const post = makePost({ imageStoragePaths: ['user-1/brand-1/img.jpg'] })
      const result = await publisher.publish(post, Platform.INSTAGRAM, makeConnection(Platform.INSTAGRAM, 'ref-ig'))

      expect(result.externalId).toBe('media-888')
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(fetchMock.mock.calls[0]![0]).toContain('/ig-biz-777/media')
      expect(fetchMock.mock.calls[1]![0]).toContain('/ig-biz-777/media_publish')
    })

    it('resolves the storage path into a signed URL before sending it to the Graph API', async () => {
      fetchMock
        .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'container-555' }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'media-888' }) })

      const storagePath = 'user-1/brand-1/photo.jpg'
      const post = makePost({ imageStoragePaths: [storagePath] })
      await publisher.publish(post, Platform.INSTAGRAM, makeConnection(Platform.INSTAGRAM, 'ref-ig'))

      expect(resolveImageUrl).toHaveBeenCalledWith(storagePath)
      const containerBody = fetchMock.mock.calls[0]![1]!.body as string
      expect(containerBody).toContain(encodeURIComponent(`https://signed.example.com/${storagePath}`))
    })
  })
})
