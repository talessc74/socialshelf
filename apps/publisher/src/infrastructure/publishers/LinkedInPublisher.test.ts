import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { LinkedInPublisher } from './LinkedInPublisher.js'
import { Platform } from '@socialshelf/domain'
import type { Post, OAuthConnection, TokenVaultPort } from '@socialshelf/domain'

const mockPost: Post = {
  id: 'post-1',
  userId: 'user-1',
  brandId: 'brand-1',
  brandProfileVersion: null,
  content: [{ platform: Platform.LINKEDIN, text: 'Hello LinkedIn!', charCount: 16 }],
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
  imagesDeletedAt: null,
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

const mockResolveImageUrl = vi.fn(async (path: string) => `https://signed.example/${path}`)

describe('LinkedInPublisher', () => {
  let publisher: LinkedInPublisher
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    publisher = new LinkedInPublisher(mockTokenVault, mockResolveImageUrl)
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('fetches person sub via /v2/userinfo and posts to /rest/posts', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sub: 'li-person-123' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: (h: string) => h === 'x-restli-id' ? 'urn:li:share:9876543' : null },
        json: async () => ({}),
      })

    const result = await publisher.publish(mockPost, Platform.LINKEDIN, mockConnection)

    expect(result.externalId).toBe('urn:li:share:9876543')
    expect(fetchMock).toHaveBeenCalledTimes(2)

    const [userinfoCall, postsCall] = fetchMock.mock.calls
    expect(userinfoCall![0]).toContain('/v2/userinfo')
    expect(postsCall![0]).toContain('/rest/posts')
  })

  it('sends LinkedIn-Version header', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ sub: 'li-person-123' }) })
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: (_: string) => 'urn:li:share:111' },
        json: async () => ({}),
      })

    await publisher.publish(mockPost, Platform.LINKEDIN, mockConnection)

    const postsHeaders = fetchMock.mock.calls[1]![1]!.headers as Record<string, string>
    expect(postsHeaders['LinkedIn-Version']).toBe('202602')
  })

  it('includes post text as commentary', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ sub: 'li-person-123' }) })
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: (_: string) => 'urn:li:share:111' },
        json: async () => ({}),
      })

    await publisher.publish(mockPost, Platform.LINKEDIN, mockConnection)

    const body = JSON.parse(fetchMock.mock.calls[1]![1]!.body as string)
    expect(body.commentary).toBe('Hello LinkedIn!')
    expect(body.visibility).toBe('PUBLIC')
  })

  it('uses person sub as author URN', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ sub: 'abc-456' }) })
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: (_: string) => 'urn:li:share:111' },
        json: async () => ({}),
      })

    await publisher.publish(mockPost, Platform.LINKEDIN, mockConnection)

    const body = JSON.parse(fetchMock.mock.calls[1]![1]!.body as string)
    expect(body.author).toBe('urn:li:person:abc-456')
  })

  it('posts as organization and skips /v2/userinfo when connection has organizationUrn', async () => {
    const orgConnection: OAuthConnection = {
      ...mockConnection,
      organizationUrn: 'urn:li:organization:9988776',
    }
    fetchMock.mockResolvedValueOnce({
      ok: true,
      headers: { get: (h: string) => h === 'x-restli-id' ? 'urn:li:share:222' : null },
      json: async () => ({}),
    })

    const result = await publisher.publish(mockPost, Platform.LINKEDIN, orgConnection)

    expect(result.externalId).toBe('urn:li:share:222')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const body = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string)
    expect(body.author).toBe('urn:li:organization:9988776')
  })

  it('uploads a single image and references it as content.media', async () => {
    const postWithImage: Post = { ...mockPost, imageStoragePaths: ['uploads/img-a.jpg'] }
    fetchMock
      // getPersonId
      .mockResolvedValueOnce({ ok: true, json: async () => ({ sub: 'li-person-123' }) })
      // initializeUpload
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ value: { uploadUrl: 'https://upload.li/a', image: 'urn:li:image:AAA' } }),
      })
      // fetch bytes from signed URL
      .mockResolvedValueOnce({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) })
      // upload bytes
      .mockResolvedValueOnce({ ok: true })
      // /rest/posts
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: (h: string) => (h === 'x-restli-id' ? 'urn:li:share:777' : null) },
        json: async () => ({}),
      })

    const result = await publisher.publish(postWithImage, Platform.LINKEDIN, mockConnection)

    expect(result.externalId).toBe('urn:li:share:777')
    expect(mockResolveImageUrl).toHaveBeenCalledWith('uploads/img-a.jpg')
    const initCall = fetchMock.mock.calls.find((c) => String(c[0]).includes('/rest/images?action=initializeUpload'))
    expect(initCall).toBeDefined()
    const postsCall = fetchMock.mock.calls.find((c) => String(c[0]).endsWith('/rest/posts'))!
    const body = JSON.parse(postsCall[1]!.body as string)
    expect(body.content).toEqual({ media: { id: 'urn:li:image:AAA' } })
  })

  it('uploads multiple images and references them as content.multiImage', async () => {
    const postWithImages: Post = {
      ...mockPost,
      imageStoragePaths: ['uploads/img-a.jpg', 'uploads/img-b.jpg'],
    }
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ sub: 'li-person-123' }) })
      // image A: init, fetch bytes, upload
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ value: { uploadUrl: 'https://upload.li/a', image: 'urn:li:image:AAA' } }),
      })
      .mockResolvedValueOnce({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) })
      .mockResolvedValueOnce({ ok: true })
      // image B: init, fetch bytes, upload
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ value: { uploadUrl: 'https://upload.li/b', image: 'urn:li:image:BBB' } }),
      })
      .mockResolvedValueOnce({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) })
      .mockResolvedValueOnce({ ok: true })
      // /rest/posts
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: (h: string) => (h === 'x-restli-id' ? 'urn:li:share:888' : null) },
        json: async () => ({}),
      })

    const result = await publisher.publish(postWithImages, Platform.LINKEDIN, mockConnection)

    expect(result.externalId).toBe('urn:li:share:888')
    const postsCall = fetchMock.mock.calls.find((c) => String(c[0]).endsWith('/rest/posts'))!
    const body = JSON.parse(postsCall[1]!.body as string)
    expect(body.content).toEqual({
      multiImage: { images: [{ id: 'urn:li:image:AAA' }, { id: 'urn:li:image:BBB' }] },
    })
  })

  it('throws when image upload fails', async () => {
    const postWithImage: Post = { ...mockPost, imageStoragePaths: ['uploads/img-a.jpg'] }
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ sub: 'li-person-123' }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ value: { uploadUrl: 'https://upload.li/a', image: 'urn:li:image:AAA' } }),
      })
      .mockResolvedValueOnce({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) })
      .mockResolvedValueOnce({ ok: false, status: 400, text: async () => 'bad upload' })

    await expect(
      publisher.publish(postWithImage, Platform.LINKEDIN, mockConnection),
    ).rejects.toThrow('LinkedIn image upload failed: 400')
  })

  it('throws when /v2/userinfo returns an error', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401 })

    await expect(
      publisher.publish(mockPost, Platform.LINKEDIN, mockConnection),
    ).rejects.toThrow('LinkedIn /userinfo failed: 401')
  })

  it('throws when LinkedIn REST API returns an error', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ sub: 'li-person-123' }) })
      .mockResolvedValueOnce({ ok: false, status: 422, text: async () => 'Unprocessable' })

    await expect(
      publisher.publish(mockPost, Platform.LINKEDIN, mockConnection),
    ).rejects.toThrow('LinkedIn publish failed')
  })
})
