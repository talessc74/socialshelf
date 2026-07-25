import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DeletePostUseCase } from './DeletePostUseCase.js'
import type { PostRepository } from '@socialshelf/domain'

describe('DeletePostUseCase', () => {
  let postRepo: PostRepository
  let useCase: DeletePostUseCase

  beforeEach(() => {
    postRepo = {
      save: vi.fn(),
      findById: vi.fn(),
      findByIdAndBrand: vi.fn(),
      claimForPublishing: vi.fn(),
      findByBrand: vi.fn(),
      findScheduledBefore: vi.fn(),
      delete: vi.fn().mockResolvedValue(undefined),
      findPublishedForImageCleanup: vi.fn(),
      findSavedForLaterByBrand: vi.fn(),
    }
    useCase = new DeletePostUseCase(postRepo)
  })

  it('calls delete on the repository with the correct postId, userId and brandId', async () => {
    await useCase.execute('post-123', 'user-456', 'brand-789')

    expect(postRepo.delete).toHaveBeenCalledWith('post-123', 'user-456', 'brand-789')
    expect(postRepo.delete).toHaveBeenCalledTimes(1)
  })
})
