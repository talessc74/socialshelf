import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MetaAnalyticsReader } from './MetaAnalyticsReader.js'
import { Platform } from '@socialshelf/domain'
import type { OAuthConnection, TokenVaultPort } from '@socialshelf/domain'

function makeConnection(platform: Platform): OAuthConnection {
  return {
    id: `conn-${platform}`,
    userId: 'user-1',
    brandId: 'brand-1',
    platform,
    pairwiseId: `pairwise-${platform}`,
    tokenRef: `token-ref-${platform}`,
    scopes: [],
    expiresAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

function makeVault(stored: object): TokenVaultPort {
  return {
    store: vi.fn(),
    retrieve: vi.fn().mockResolvedValue(JSON.stringify(stored)),
    delete: vi.fn(),
  }
}

describe('MetaAnalyticsReader', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('Facebook', () => {
    it('maps insights/likes/comments/shares to PostMetrics', async () => {
      const vault = makeVault({ page_access_token: 'page-token' })
      const reader = new MetaAnalyticsReader(vault)

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          insights: { data: [{ values: [{ value: 1500 }] }] },
          likes: { summary: { total_count: 30 } },
          comments: { summary: { total_count: 4 } },
          shares: { count: 2 },
        }),
      })

      const result = await reader.fetchPostMetrics('page-999_post-111', makeConnection(Platform.FACEBOOK))

      expect(result).toEqual({ impressions: 1500, likes: 30, comments: 4, shares: 2 })
      expect(fetchMock.mock.calls[0]![0]).toContain('/page-999_post-111')
    })

    it('defaults shares to 0 when absent', async () => {
      const vault = makeVault({ page_access_token: 'page-token' })
      const reader = new MetaAnalyticsReader(vault)

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          insights: { data: [{ values: [{ value: 0 }] }] },
          likes: { summary: { total_count: 0 } },
          comments: { summary: { total_count: 0 } },
        }),
      })

      const result = await reader.fetchPostMetrics('page-999_post-222', makeConnection(Platform.FACEBOOK))

      expect(result.shares).toBe(0)
    })

    it('throws when the Graph API returns an error', async () => {
      const vault = makeVault({ page_access_token: 'page-token' })
      const reader = new MetaAnalyticsReader(vault)

      fetchMock.mockResolvedValueOnce({ ok: false, status: 400, text: async () => 'Bad Request' })

      await expect(
        reader.fetchPostMetrics('page-999_post-111', makeConnection(Platform.FACEBOOK)),
      ).rejects.toThrow('Facebook metrics fetch failed: 400 Bad Request')
    })
  })

  describe('Instagram', () => {
    it('maps the insights metric list to PostMetrics', async () => {
      const vault = makeVault({ page_access_token: 'page-token' })
      const reader = new MetaAnalyticsReader(vault)

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            { name: 'reach', values: [{ value: 800 }] },
            { name: 'likes', values: [{ value: 60 }] },
            { name: 'comments', values: [{ value: 9 }] },
            { name: 'shares', values: [{ value: 3 }] },
          ],
        }),
      })

      const result = await reader.fetchPostMetrics('media-888', makeConnection(Platform.INSTAGRAM))

      expect(result).toEqual({ impressions: 800, likes: 60, comments: 9, shares: 3 })
      expect(fetchMock.mock.calls[0]![0]).toContain('/media-888/insights')
    })

    it('defaults missing metrics to 0', async () => {
      const vault = makeVault({ page_access_token: 'page-token' })
      const reader = new MetaAnalyticsReader(vault)

      fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) })

      const result = await reader.fetchPostMetrics('media-888', makeConnection(Platform.INSTAGRAM))

      expect(result).toEqual({ impressions: 0, likes: 0, comments: 0, shares: 0 })
    })
  })
})
