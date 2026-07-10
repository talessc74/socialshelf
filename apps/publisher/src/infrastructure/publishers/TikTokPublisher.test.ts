import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { TikTokPublisher } from './TikTokPublisher.js'
import { Platform } from '@socialshelf/domain'
import type { Post, OAuthConnection, TokenVaultPort } from '@socialshelf/domain'

const mockPost: Post = {
  id: 'post-1',
  userId: 'user-1',
  brandId: 'brand-1',
  brandProfileVersion: null,
  content: [{ platform: Platform.TIKTOK, text: 'Hello TikTok!', charCount: 13 }],
  imageStoragePaths: [],
  videoStoragePath: 'videos/user-1/brand-1/clip.mp4',
  videoConsentAcceptedAt: new Date('2026-07-08T00:00:00.000Z'),
  status: 'scheduled',
  origin: 'manual',
  scheduledAt: null,
  publishedAt: null,
  externalIds: {},
  sourceArticleUrl: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

const mockConnection: OAuthConnection = {
  id: 'conn-tiktok',
  userId: 'user-1',
  brandId: 'brand-1',
  platform: Platform.TIKTOK,
  pairwiseId: 'pairwise-tiktok',
  tokenRef: 'oauth-token-pairwise-tiktok',
  scopes: ['user.info.basic', 'video.publish'],
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

const resolveVideoUrl = vi.fn().mockResolvedValue('https://radiokactus.com/media/tiktok/videos/user-1/brand-1/clip.mp4')

describe('TikTokPublisher', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('throws when the post has no video', async () => {
    const vault = makeVault({ access_token: 'tt-access', refresh_token: 'tt-refresh' })
    const publisher = new TikTokPublisher(vault, resolveVideoUrl)

    await expect(
      publisher.publish({ ...mockPost, videoStoragePath: null }, Platform.TIKTOK, mockConnection),
    ).rejects.toThrow('TikTok requires a video')
  })

  it('initializes publish with PULL_FROM_URL and returns the publish_id once complete', async () => {
    const vault = makeVault({ access_token: 'tt-access', refresh_token: 'tt-refresh' })
    const publisher = new TikTokPublisher(vault, resolveVideoUrl)

    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { publish_id: 'pub-123' }, error: { code: 'ok', message: '' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { status: 'PUBLISH_COMPLETE' }, error: { code: 'ok', message: '' } }),
      })

    const result = await publisher.publish(mockPost, Platform.TIKTOK, mockConnection)

    expect(result.externalId).toBe('pub-123')
    expect(fetchMock).toHaveBeenCalledTimes(2)

    const initCall = fetchMock.mock.calls[0]!
    expect(initCall[0]).toContain('/post/publish/video/init/')
    const initBody = JSON.parse(initCall[1]!.body as string)
    expect(initBody.source_info).toEqual({
      source: 'PULL_FROM_URL',
      video_url: 'https://radiokactus.com/media/tiktok/videos/user-1/brand-1/clip.mp4',
    })
    expect(initBody.post_info.title).toBe('Hello TikTok!')
    expect(initBody.post_info.privacy_level).toBe('SELF_ONLY')
  })

  it('uses Bearer token in Authorization header', async () => {
    const vault = makeVault({ access_token: 'tt-access', refresh_token: 'tt-refresh' })
    const publisher = new TikTokPublisher(vault, resolveVideoUrl)

    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { publish_id: 'pub-1' }, error: {} }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { status: 'PUBLISH_COMPLETE' }, error: {} }),
      })

    await publisher.publish(mockPost, Platform.TIKTOK, mockConnection)

    const headers = fetchMock.mock.calls[0]![1]!.headers as Record<string, string>
    expect(headers['Authorization']).toBe('Bearer tt-access')
  })

  it('throws when publish init fails with a non-401 error', async () => {
    const vault = makeVault({ access_token: 'tt-access', refresh_token: 'tt-refresh' })
    const publisher = new TikTokPublisher(vault, resolveVideoUrl)

    fetchMock.mockResolvedValueOnce({ ok: false, status: 400, text: async () => 'Bad Request' })

    await expect(publisher.publish(mockPost, Platform.TIKTOK, mockConnection)).rejects.toThrow(
      'TikTok publish init failed: 400 Bad Request',
    )
  })

  it('throws when TikTok reports FAILED status', async () => {
    const vault = makeVault({ access_token: 'tt-access', refresh_token: 'tt-refresh' })
    const publisher = new TikTokPublisher(vault, resolveVideoUrl)

    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { publish_id: 'pub-1' }, error: {} }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { status: 'FAILED' }, error: { message: 'video rejected' } }),
      })

    await expect(publisher.publish(mockPost, Platform.TIKTOK, mockConnection)).rejects.toThrow(
      'TikTok publish pub-1 failed: video rejected',
    )
  })

  it('refreshes token on 401 during init and retries successfully', async () => {
    const vault = makeVault({ access_token: 'expired-token', refresh_token: 'valid-refresh' })
    const publisher = new TikTokPublisher(vault, resolveVideoUrl)

    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 401 })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ access_token: 'new-access', refresh_token: 'new-refresh', expires_in: 86400 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { publish_id: 'pub-999' }, error: {} }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { status: 'PUBLISH_COMPLETE' }, error: {} }),
      })

    const result = await publisher.publish(mockPost, Platform.TIKTOK, mockConnection)

    expect(result.externalId).toBe('pub-999')
    expect(vi.mocked(vault.store)).toHaveBeenCalledTimes(1)
    const stored = JSON.parse(vi.mocked(vault.store).mock.calls[0]![1] as string)
    expect(stored.access_token).toBe('new-access')
    expect(stored.refresh_token).toBe('new-refresh')
  })

  it('throws when token refresh fails', async () => {
    const vault = makeVault({ access_token: 'expired-token', refresh_token: 'invalid-refresh' })
    const publisher = new TikTokPublisher(vault, resolveVideoUrl)

    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 401 })
      .mockResolvedValueOnce({ ok: false, status: 400, text: async () => 'invalid_grant' })

    await expect(publisher.publish(mockPost, Platform.TIKTOK, mockConnection)).rejects.toThrow(
      'TikTok token refresh failed: 400 invalid_grant',
    )
  })

  it('polls status until PUBLISH_COMPLETE, waiting between attempts', async () => {
    vi.useFakeTimers()
    const vault = makeVault({ access_token: 'tt-access', refresh_token: 'tt-refresh' })
    const publisher = new TikTokPublisher(vault, resolveVideoUrl)

    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { publish_id: 'pub-slow' }, error: {} }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { status: 'PROCESSING_DOWNLOAD' }, error: {} }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { status: 'PUBLISH_COMPLETE' }, error: {} }),
      })

    const resultPromise = publisher.publish(mockPost, Platform.TIKTOK, mockConnection)
    await vi.runAllTimersAsync()
    const result = await resultPromise

    expect(result.externalId).toBe('pub-slow')
    expect(fetchMock).toHaveBeenCalledTimes(3)
    vi.useRealTimers()
  })
})
