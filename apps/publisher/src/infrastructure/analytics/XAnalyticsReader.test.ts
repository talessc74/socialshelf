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

  it('refreshes token on 401 and retries successfully', async () => {
    const vault = makeVault({ access_token: 'expired-token', refresh_token: 'valid-refresh' })
    const reader = new XAnalyticsReader(vault)

    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 401, text: async () => 'Unauthorized' })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'new-access', refresh_token: 'new-refresh', expires_in: 7200, scope: 'tweet.read' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { public_metrics: { impression_count: 10, like_count: 1, reply_count: 0, retweet_count: 0, quote_count: 0 } } }),
      })

    const result = await reader.fetchPostMetrics('tweet-123', mockConnection)

    expect(result).toEqual({ impressions: 10, likes: 1, comments: 0, shares: 0 })
    expect(fetchMock).toHaveBeenCalledTimes(3)
    const stored = JSON.parse(vi.mocked(vault.store).mock.calls[0]![1] as string)
    expect(stored.access_token).toBe('new-access')
    const retryHeaders = fetchMock.mock.calls[2]![1]!.headers as Record<string, string>
    expect(retryHeaders['Authorization']).toBe('Bearer new-access')
  })

  it('throws on 401 when no refresh token is stored', async () => {
    const vault = makeVault({ access_token: 'expired-token' })
    const reader = new XAnalyticsReader(vault)

    fetchMock.mockResolvedValueOnce({ ok: false, status: 401, text: async () => 'Unauthorized' })

    await expect(reader.fetchPostMetrics('tweet-123', mockConnection)).rejects.toThrow(
      'X metrics fetch failed: a conexão perdeu a validade ou uma permissão necessária para ler as métricas — reconecte em Central de Contas',
    )
  })
})
