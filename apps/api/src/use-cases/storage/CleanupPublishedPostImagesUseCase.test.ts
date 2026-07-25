import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Platform } from '@socialshelf/domain'
import type { Post, PostRepository } from '@socialshelf/domain'
import { CleanupPublishedPostImagesUseCase } from './CleanupPublishedPostImagesUseCase.js'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function makePost(overrides: Partial<Post> = {}): Post {
  return {
    id: 'post-1',
    userId: 'user-1',
    brandId: 'brand-1',
    brandProfileVersion: null,
    content: [{ platform: Platform.INSTAGRAM, text: 'Post publicado', charCount: 14 }],
    imageStoragePaths: ['user-1/brand-1/photo-1.jpg', 'user-1/brand-1/photo-2.jpg'],
    videoStoragePath: null,
    videoConsentAcceptedAt: null,
    status: 'published',
    origin: 'manual',
    campaignId: null,
    scheduledAt: null,
    publishedAt: new Date('2026-07-01T00:00:00.000Z'),
    externalIds: {},
    sourceArticleUrl: null,
    imagesDeletedAt: null,
    savedForLater: false,
    createdAt: new Date('2026-06-20T00:00:00.000Z'),
    updatedAt: new Date('2026-06-20T00:00:00.000Z'),
    ...overrides,
  }
}

describe('CleanupPublishedPostImagesUseCase', () => {
  let postRepo: PostRepository
  let useCase: CleanupPublishedPostImagesUseCase

  beforeEach(() => {
    mockFetch.mockReset()
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ success: true }) })
    postRepo = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn(),
      findByIdAndBrand: vi.fn(),
      findByBrand: vi.fn(),
      findScheduledBefore: vi.fn(),
      findPublishedForImageCleanup: vi.fn().mockResolvedValue([]),
      findSavedForLaterByBrand: vi.fn(),
      delete: vi.fn(),
      claimForPublishing: vi.fn(),
    }
    useCase = new CleanupPublishedPostImagesUseCase(postRepo, 'http://localhost:3003', 'internal-secret', 7)
  })

  it('deletes every image blob of an eligible post and marks imagesDeletedAt', async () => {
    const post = makePost()
    vi.mocked(postRepo.findPublishedForImageCleanup).mockResolvedValue([post])

    const result = await useCase.execute()

    expect(mockFetch).toHaveBeenCalledTimes(2)
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('http://localhost:3003/images/delete')
    expect(init.method).toBe('POST')
    expect((init.headers as Headers).get('X-Internal-Secret')).toBe('internal-secret')
    expect(init.body).toBe(JSON.stringify({ path: 'user-1/brand-1/photo-1.jpg' }))
    expect(postRepo.save).toHaveBeenCalledWith(expect.objectContaining({ id: 'post-1', imagesDeletedAt: expect.any(Date) }))
    expect(result).toEqual({ postsCleaned: 1, blobsDeleted: 2, blobsFailed: 0 })
  })

  it('marks the post cleaned even when a blob delete fails, and reports the failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    const post = makePost()
    vi.mocked(postRepo.findPublishedForImageCleanup).mockResolvedValue([post])

    const result = await useCase.execute()

    expect(postRepo.save).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ postsCleaned: 1, blobsDeleted: 1, blobsFailed: 1 })
  })

  it('does nothing when there are no eligible posts', async () => {
    vi.mocked(postRepo.findPublishedForImageCleanup).mockResolvedValue([])

    const result = await useCase.execute()

    expect(mockFetch).not.toHaveBeenCalled()
    expect(postRepo.save).not.toHaveBeenCalled()
    expect(result).toEqual({ postsCleaned: 0, blobsDeleted: 0, blobsFailed: 0 })
  })

  it('queries the repository with a cutoff matching the configured retention window', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-25T00:00:00.000Z'))

    await useCase.execute()

    expect(postRepo.findPublishedForImageCleanup).toHaveBeenCalledWith(new Date('2026-07-18T00:00:00.000Z'))
    vi.useRealTimers()
  })
})
