import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CreatePostUseCase } from './CreatePostUseCase.js'
import { Platform } from '@socialshelf/domain'
import type { PostRepository } from '@socialshelf/domain'

describe('CreatePostUseCase', () => {
  let postRepo: PostRepository
  let useCase: CreatePostUseCase

  beforeEach(() => {
    postRepo = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn(),
      findByIdAndBrand: vi.fn(),
      findByBrand: vi.fn(),
      findScheduledBefore: vi.fn(),
      delete: vi.fn(),
    }
    useCase = new CreatePostUseCase(postRepo)
  })

  it('creates a post with correct userId and brandId', async () => {
    const post = await useCase.execute({
      userId: 'user-1',
      brandId: 'brand-1',
      content: [{ platform: Platform.LINKEDIN, text: 'Hello LinkedIn' }],
    })

    expect(post.userId).toBe('user-1')
    expect(post.brandId).toBe('brand-1')
    expect(post.status).toBe('draft')
  })

  it('sets charCount on each platform content', async () => {
    const post = await useCase.execute({
      userId: 'user-1',
      brandId: 'brand-1',
      content: [{ platform: Platform.TWITTER, text: 'Hello Twitter!' }],
    })

    expect(post.content[0]!.charCount).toBe(14)
  })

  it('saves the post to the repository', async () => {
    await useCase.execute({
      userId: 'user-1',
      brandId: 'brand-1',
      content: [{ platform: Platform.LINKEDIN, text: 'Hi' }],
    })

    expect(postRepo.save).toHaveBeenCalledTimes(1)
  })

  it('supports multiple platforms in one post', async () => {
    const post = await useCase.execute({
      userId: 'user-1',
      brandId: 'brand-1',
      content: [
        { platform: Platform.LINKEDIN, text: 'LinkedIn text' },
        { platform: Platform.TWITTER, text: 'Twitter text' },
      ],
    })

    expect(post.content).toHaveLength(2)
  })

  it('throws when text exceeds platform character limit', async () => {
    const longText = 'a'.repeat(281)
    await expect(
      useCase.execute({
        userId: 'user-1',
        brandId: 'brand-1',
        content: [{ platform: Platform.TWITTER, text: longText }],
      }),
    ).rejects.toThrow('exceeds 280 characters')
  })

  it('includes imageStoragePaths when provided', async () => {
    const post = await useCase.execute({
      userId: 'user-1',
      brandId: 'brand-1',
      content: [{ platform: Platform.INSTAGRAM, text: 'Photo post' }],
      imageStoragePaths: ['gs://bucket/photo.jpg'],
    })

    expect(post.imageStoragePaths).toEqual(['gs://bucket/photo.jpg'])
  })

  it('generates a unique UUID id for each post', async () => {
    const post1 = await useCase.execute({
      userId: 'user-1',
      brandId: 'brand-1',
      content: [{ platform: Platform.LINKEDIN, text: 'Post 1' }],
    })
    const post2 = await useCase.execute({
      userId: 'user-1',
      brandId: 'brand-1',
      content: [{ platform: Platform.LINKEDIN, text: 'Post 2' }],
    })

    expect(post1.id).not.toBe(post2.id)
  })
})
