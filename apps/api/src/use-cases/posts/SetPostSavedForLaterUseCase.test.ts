import { describe, it, expect, vi } from 'vitest'
import { Platform } from '@socialshelf/domain'
import type { Post, PostRepository } from '@socialshelf/domain'
import { SetPostSavedForLaterUseCase } from './SetPostSavedForLaterUseCase.js'

function makePost(overrides: Partial<Post> = {}): Post {
  return {
    id: 'post-1',
    userId: 'user-1',
    brandId: 'brand-1',
    brandProfileVersion: null,
    content: [{ platform: Platform.LINKEDIN, text: 'Rascunho', charCount: 8 }],
    imageStoragePaths: [],
    videoStoragePath: null,
    videoConsentAcceptedAt: null,
    status: 'ai-draft',
    origin: 'autonomy-tick',
    campaignId: null,
    scheduledAt: null,
    publishedAt: null,
    externalIds: {},
    sourceArticleUrl: null,
    imagesDeletedAt: null,
    savedForLater: false,
    createdAt: new Date('2026-06-20T00:00:00.000Z'),
    updatedAt: new Date('2026-06-20T00:00:00.000Z'),
    ...overrides,
  }
}

describe('SetPostSavedForLaterUseCase', () => {
  it('marks the post as saved for later and persists it', async () => {
    const postRepo: PostRepository = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn(),
      findByIdAndBrand: vi.fn(),
      findByBrand: vi.fn(),
      findScheduledBefore: vi.fn(),
      findPublishedForImageCleanup: vi.fn(),
      findSavedForLaterByBrand: vi.fn(),
      delete: vi.fn(),
      claimForPublishing: vi.fn(),
    }
    const useCase = new SetPostSavedForLaterUseCase(postRepo)
    const post = makePost()

    const result = await useCase.execute(post, true)

    expect(result.savedForLater).toBe(true)
    expect(postRepo.save).toHaveBeenCalledWith(expect.objectContaining({ id: 'post-1', savedForLater: true }))
  })

  it('unmarks the post when toggled off', async () => {
    const postRepo: PostRepository = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn(),
      findByIdAndBrand: vi.fn(),
      findByBrand: vi.fn(),
      findScheduledBefore: vi.fn(),
      findPublishedForImageCleanup: vi.fn(),
      findSavedForLaterByBrand: vi.fn(),
      delete: vi.fn(),
      claimForPublishing: vi.fn(),
    }
    const useCase = new SetPostSavedForLaterUseCase(postRepo)
    const post = makePost({ savedForLater: true })

    const result = await useCase.execute(post, false)

    expect(result.savedForLater).toBe(false)
    expect(postRepo.save).toHaveBeenCalledWith(expect.objectContaining({ id: 'post-1', savedForLater: false }))
  })
})
