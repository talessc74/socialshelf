import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { XPublisher } from './XPublisher.js'
import { Platform } from '@socialshelf/domain'
import type { Post, OAuthConnection, TokenVaultPort } from '@socialshelf/domain'

const mockPost: Post = {
  id: 'post-1',
  userId: 'user-1',
  brandId: 'brand-1',
  brandProfileVersion: null,
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

function makeVault(stored: object): TokenVaultPort {
  return {
    store: vi.fn(),
    retrieve: vi.fn().mockResolvedValue(JSON.stringify(stored)),
    delete: vi.fn(),
  }
}

describe('XPublisher', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('posts tweet and returns externalId', async () => {
    const vault = makeVault({ access_token: 'x-access-token', refresh_token: 'x-refresh' })
    const publisher = new XPublisher(vault)

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: { id: '1234567890', text: 'Hello X!' } }),
    })

    const result = await publisher.publish(mockPost, Platform.TWITTER, mockConnection)

    expect(result.externalId).toBe('1234567890')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]![0]).toContain('/2/tweets')
  })

  it('sends post text in tweet body', async () => {
    const vault = makeVault({ access_token: 'x-access-token', refresh_token: 'x-refresh' })
    const publisher = new XPublisher(vault)

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: { id: '999', text: 'Hello X!' } }),
    })

    await publisher.publish(mockPost, Platform.TWITTER, mockConnection)

    const body = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string)
    expect(body.text).toBe('Hello X!')
  })

  it('uses Bearer token in Authorization header', async () => {
    const vault = makeVault({ access_token: 'x-access-token', refresh_token: 'x-refresh' })
    const publisher = new XPublisher(vault)

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: { id: '999' } }),
    })

    await publisher.publish(mockPost, Platform.TWITTER, mockConnection)

    const headers = fetchMock.mock.calls[0]![1]!.headers as Record<string, string>
    expect(headers['Authorization']).toBe('Bearer x-access-token')
  })

  it('throws when X API returns a non-401 error', async () => {
    const vault = makeVault({ access_token: 'x-access-token', refresh_token: 'x-refresh' })
    const publisher = new XPublisher(vault)

    fetchMock.mockResolvedValueOnce({ ok: false, status: 403, text: async () => 'Forbidden' })

    await expect(
      publisher.publish(mockPost, Platform.TWITTER, mockConnection),
    ).rejects.toThrow('X publish failed: 403 Forbidden')
  })

  it('refreshes token on 401 and retries successfully', async () => {
    const vault = makeVault({ access_token: 'expired-token', refresh_token: 'valid-refresh' })
    const publisher = new XPublisher(vault)

    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 401, text: async () => 'Unauthorized' })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ access_token: 'new-access', refresh_token: 'new-refresh', expires_in: 7200, scope: 'tweet.read tweet.write' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { id: 'tweet-123' } }),
      })

    const result = await publisher.publish(mockPost, Platform.TWITTER, mockConnection)

    expect(result.externalId).toBe('tweet-123')
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(vi.mocked(vault.store)).toHaveBeenCalledTimes(1)
    const stored = JSON.parse(vi.mocked(vault.store).mock.calls[0]![1] as string)
    expect(stored.access_token).toBe('new-access')
    expect(stored.refresh_token).toBe('new-refresh')
  })

  it('uses new access token on retry after refresh', async () => {
    const vault = makeVault({ access_token: 'expired-token', refresh_token: 'valid-refresh' })
    const publisher = new XPublisher(vault)

    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 401, text: async () => 'Unauthorized' })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ access_token: 'new-access', refresh_token: 'new-refresh', expires_in: 7200, scope: 'tweet.read tweet.write' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { id: 'tweet-456' } }),
      })

    await publisher.publish(mockPost, Platform.TWITTER, mockConnection)

    const retryHeaders = fetchMock.mock.calls[2]![1]!.headers as Record<string, string>
    expect(retryHeaders['Authorization']).toBe('Bearer new-access')
  })

  it('throws when token refresh endpoint fails', async () => {
    const vault = makeVault({ access_token: 'expired-token', refresh_token: 'invalid-refresh' })
    const publisher = new XPublisher(vault)

    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 401, text: async () => 'Unauthorized' })
      .mockResolvedValueOnce({ ok: false, status: 400, text: async () => 'invalid_grant' })

    await expect(
      publisher.publish(mockPost, Platform.TWITTER, mockConnection),
    ).rejects.toThrow('X token refresh failed: 400 invalid_grant')
  })

  it('throws on 401 when no refresh token is stored', async () => {
    const vault = makeVault({ access_token: 'expired-token' })
    const publisher = new XPublisher(vault)

    fetchMock.mockResolvedValueOnce({ ok: false, status: 401, text: async () => 'Unauthorized' })

    await expect(
      publisher.publish(mockPost, Platform.TWITTER, mockConnection),
    ).rejects.toThrow('X publish failed: 401 Unauthorized')
  })

  it('throws when retry after refresh also fails', async () => {
    const vault = makeVault({ access_token: 'expired-token', refresh_token: 'valid-refresh' })
    const publisher = new XPublisher(vault)

    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 401, text: async () => 'Unauthorized' })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ access_token: 'new-access', refresh_token: 'new-refresh', expires_in: 7200, scope: 'tweet.read tweet.write' }),
      })
      .mockResolvedValueOnce({ ok: false, status: 403, text: async () => 'Forbidden' })

    await expect(
      publisher.publish(mockPost, Platform.TWITTER, mockConnection),
    ).rejects.toThrow('X publish failed after token refresh: 403 Forbidden')
  })
})
