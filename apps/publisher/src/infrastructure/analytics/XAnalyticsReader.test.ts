import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { XAnalyticsReader } from './XAnalyticsReader.js'
import { Platform } from '@socialshelf/domain'
import type { OAuthConnection, TokenVaultPort } from '@socialshelf/domain'

const mockConnection: OAuthConnection = {
  id: 'conn-x',
  userId: 'user-1',
  brandId: 'brand-1',
  platform: Platform.TWITTER,
  pairwiseId: 'pairwise-x',
  tokenRef: 'oauth-token-pairwise-x',
  scopes: ['tweet.read'],
  expiresAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

function makeVault(stored: object): TokenVaultPort {
  return {
    store: vi.fn(),
    retrieve: vi.fn().mockResolvedValue(JSON.stringify(stored)),
    delete: vi.fn(),
  }
}

describe('XAnalyticsReader', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('maps public_metrics to PostMetrics', async () => {
    const vault = makeVault({ access_token: 'x-access-token' })
    const reader = new XAnalyticsReader(vault)

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          public_metrics: {
            impression_count: 1000,
            like_count: 50,
            reply_count: 5,
            retweet_count: 3,
            quote_count: 2,
          },
        },
      }),
    })

    const result = await reader.fetchPostMetrics('tweet-123', mockConnection)

    expect(result).toEqual({ impressions: 1000, likes: 50, comments: 5, shares: 5 })
  })

  it('uses Bearer token in Authorization header', async () => {
    const vault = makeVault({ access_token: 'x-access-token' })
    const reader = new XAnalyticsReader(vault)

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { public_metrics: { impression_count: 0, like_count: 0, reply_count: 0, retweet_count: 0, quote_count: 0 } } }),
    })

    await reader.fetchPostMetrics('tweet-123', mockConnection)

    const headers = fetchMock.mock.calls[0]![1]!.headers as Record<string, string>
    expect(headers['Authorization']).toBe('Bearer x-access-token')
  })

  it('throws when the X API returns an error', async () => {
    const vault = makeVault({ access_token: 'x-access-token' })
    const reader = new XAnalyticsReader(vault)

    fetchMock.mockResolvedValueOnce({ ok: false, status: 404, text: async () => 'Not Found' })

    await expect(reader.fetchPostMetrics('tweet-123', mockConnection)).rejects.toThrow(
      'X metrics fetch failed: 404 Not Found',
    )
  })
})
