import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { LinkedInPublisher } from './LinkedInPublisher.js'
import { Platform } from '@socialshelf/domain'
import type { Post, OAuthConnection, TokenVaultPort } from '@socialshelf/domain'

const mockPost: Post = {
  id: 'post-1',
  userId: 'user-1',
  brandId: 'brand-1',
  content: [{ platform: Platform.LINKEDIN, text: 'Hello LinkedIn!', charCount: 16 }],
  imageStoragePaths: [],
  status: 'scheduled',
  scheduledAt: null,
  publishedAt: null,
  externalIds: {},
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
}

const mockConnection: OAuthConnection = {
  id: 'conn-1',
  userId: 'user-1',
  brandId: 'brand-1',
  platform: Platform.LINKEDIN,
  pairwiseId: 'pairwise-li',
  tokenRef: 'oauth-token-pairwise-li',
  scopes: ['openid', 'profile', 'w_member_social'],
  expiresAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

const mockTokenVault: TokenVaultPort = {
  store: vi.fn(),
  retrieve: vi.fn().mockResolvedValue(
    JSON.stringify({ access_token: 'li-access-token', refresh_token: null }),
  ),
  delete: vi.fn(),
}

describe('LinkedInPublisher', () => {
  let publisher: LinkedInPublisher
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    publisher = new LinkedInPublisher(mockTokenVault)
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('fetches person ID and posts UGC post', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sub: 'li-person-123' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'urn:li:ugcPost:9876543' }),
      })

    const result = await publisher.publish(mockPost, Platform.LINKEDIN, mockConnection)

    expect(result.externalId).toBe('urn:li:ugcPost:9876543')
    expect(fetchMock).toHaveBeenCalledTimes(2)

    const [userinfoCall, ugcCall] = fetchMock.mock.calls
    expect(userinfoCall[0]).toContain('userinfo')
    expect(ugcCall[0]).toContain('ugcPosts')
  })

  it('includes post text in UGC body', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ sub: 'li-person-123' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'urn:li:ugcPost:111' }) })

    await publisher.publish(mockPost, Platform.LINKEDIN, mockConnection)

    const ugcBody = JSON.parse(fetchMock.mock.calls[1]![1]!.body as string)
    expect(ugcBody.specificContent['com.linkedin.ugc.ShareContent'].shareCommentary.text).toBe(
      'Hello LinkedIn!',
    )
  })

  it('uses person sub as author URN', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ sub: 'abc-456' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'urn:li:ugcPost:111' }) })

    await publisher.publish(mockPost, Platform.LINKEDIN, mockConnection)

    const ugcBody = JSON.parse(fetchMock.mock.calls[1]![1]!.body as string)
    expect(ugcBody.author).toBe('urn:li:person:abc-456')
  })

  it('throws when LinkedIn API returns an error', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ sub: 'li-person-123' }) })
      .mockResolvedValueOnce({ ok: false, status: 422, text: async () => 'Unprocessable' })

    await expect(
      publisher.publish(mockPost, Platform.LINKEDIN, mockConnection),
    ).rejects.toThrow('LinkedIn publish failed')
  })
})
