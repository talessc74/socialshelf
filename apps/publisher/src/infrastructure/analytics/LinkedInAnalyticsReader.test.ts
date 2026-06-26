import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { LinkedInAnalyticsReader } from './LinkedInAnalyticsReader.js'
import { Platform } from '@socialshelf/domain'
import type { OAuthConnection, TokenVaultPort } from '@socialshelf/domain'

const mockConnection: OAuthConnection = {
  id: 'conn-li',
  userId: 'user-1',
  brandId: 'brand-1',
  platform: Platform.LINKEDIN,
  pairwiseId: 'pairwise-li',
  tokenRef: 'oauth-token-pairwise-li',
  scopes: ['r_organization_social'],
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

describe('LinkedInAnalyticsReader', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('maps socialActions summary to PostMetrics', async () => {
    const vault = makeVault({ access_token: 'li-access-token' })
    const reader = new LinkedInAnalyticsReader(vault)

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        likesSummary: { totalLikes: 42 },
        commentsSummary: { totalFirstLevelComments: 7 },
      }),
    })

    const result = await reader.fetchPostMetrics('urn:li:share:9876543', mockConnection)

    expect(result).toEqual({ impressions: 0, likes: 42, comments: 7, shares: 0 })
  })

  it('sends LinkedIn-Version header', async () => {
    const vault = makeVault({ access_token: 'li-access-token' })
    const reader = new LinkedInAnalyticsReader(vault)

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ likesSummary: { totalLikes: 0 }, commentsSummary: { totalFirstLevelComments: 0 } }),
    })

    await reader.fetchPostMetrics('urn:li:share:111', mockConnection)

    const headers = fetchMock.mock.calls[0]![1]!.headers as Record<string, string>
    expect(headers['LinkedIn-Version']).toBe('202602')
  })

  it('throws when the LinkedIn API returns an error', async () => {
    const vault = makeVault({ access_token: 'li-access-token' })
    const reader = new LinkedInAnalyticsReader(vault)

    fetchMock.mockResolvedValueOnce({ ok: false, status: 403, text: async () => 'Forbidden' })

    await expect(reader.fetchPostMetrics('urn:li:share:111', mockConnection)).rejects.toThrow(
      'LinkedIn metrics fetch failed: 403 Forbidden',
    )
  })
})
