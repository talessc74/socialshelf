import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { XPublisher } from './XPublisher.js'
import { Platform } from '@socialshelf/domain'
import type { Post, OAuthConnection, TokenVaultPort } from '@socialshelf/domain'

const mockPost: Post = {
  id: 'post-1',
  userId: 'user-1',
  brandId: 'brand-1',
  content: [{ platform: Platform.TWITTER, text: 'Hello X!', charCount: 8 }],
  imageStoragePaths: [],
  status: 'scheduled',
  scheduledAt: null,
  publishedAt: null,
  externalIds: {},
  createdAt: new Date(),
  updatedAt: new Date(),
}

const mockConnection: OAuthConnection = {
  id: 'conn-x',
  userId: 'user-1',
  brandId: 'brand-1',
  platform: Platform.TWITTER,
  pairwiseId: 'pairwise-x',
  tokenRef: 'oauth-token-pairwise-x',
  scopes: ['tweet.read', 'tweet.write'],
  expiresAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

const mockTokenVault: TokenVaultPort = {
  store: vi.fn(),
  retrieve: vi.fn().mockResolvedValue(
    JSON.stringify({ access_token: 'x-access-token', refresh_token: 'x-refresh' }),
  ),
  delete: vi.fn(),
}

describe('XPublisher', () => {
  let publisher: XPublisher
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    publisher = new XPublisher(mockTokenVault)
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('posts tweet and returns externalId', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { id: '1234567890', text: 'Hello X!' } }),
    })

    const result = await publisher.publish(mockPost, Platform.TWITTER, mockConnection)

    expect(result.externalId).toBe('1234567890')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]![0]).toContain('/2/tweets')
  })

  it('sends post text in tweet body', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { id: '999', text: 'Hello X!' } }),
    })

    await publisher.publish(mockPost, Platform.TWITTER, mockConnection)

    const body = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string)
    expect(body.text).toBe('Hello X!')
  })

  it('uses Bearer token in Authorization header', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { id: '999' } }),
    })

    await publisher.publish(mockPost, Platform.TWITTER, mockConnection)

    const headers = fetchMock.mock.calls[0]![1]!.headers as Record<string, string>
    expect(headers['Authorization']).toBe('Bearer x-access-token')
  })

  it('throws when X API returns an error', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 403, text: async () => 'Forbidden' })

    await expect(
      publisher.publish(mockPost, Platform.TWITTER, mockConnection),
    ).rejects.toThrow('X publish failed')
  })
})
