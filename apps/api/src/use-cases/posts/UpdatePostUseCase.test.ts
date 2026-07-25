import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UpdatePostUseCase } from './UpdatePostUseCase.js'
import { Platform } from '@socialshelf/domain'
import type { PostRepository, Post } from '@socialshelf/domain'

function makePost(overrides: Partial<Post> = {}): Post {
  return {
    id: 'post-1',
    userId: 'user-1',
    brandId: 'user-1',
    brandProfileVersion: null,
    content: [{ platform: Platform.LINKEDIN, text: 'Old text', charCount: 8 }],
    imageStoragePaths: [],
    videoStoragePath: null,
    videoConsentAcceptedAt: null,
    status: 'scheduled',
    origin: 'manual',
    campaignId: null,
    scheduledAt: new Date('2026-07-01T12:00:00.000Z'),
    publishedAt: null,
    externalIds: {},
    sourceArticleUrl: null,
    imagesDeletedAt: null,
    createdAt: new Date('2026-06-20T00:00:00.000Z'),
    updatedAt: new Date('2026-06-20T00:00:00.000Z'),
    ...overrides,
  }
}

describe('UpdatePostUseCase', () => {
  let postRepo: PostRepository
  let useCase: UpdatePostUseCase

  beforeEach(() => {
    postRepo = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn(),
      findByIdAndBrand: vi.fn(),
      claimForPublishing: vi.fn(),
      findByBrand: vi.fn(),
      findScheduledBefore: vi.fn(),
      delete: vi.fn(),
      findPublishedForImageCleanup: vi.fn(),
    }
    useCase = new UpdatePostUseCase(postRepo)
  })

  it('updates the content and recalculates charCount', async () => {
    const updated = await useCase.execute({
      post: makePost(),
      content: [{ platform: Platform.LINKEDIN, text: 'New text here' }],
    })

    expect(updated.content).toEqual([{ platform: Platform.LINKEDIN, text: 'New text here', charCount: 13 }])
  })

  it('preserves id, status and scheduledAt from the original post', async () => {
    const original = makePost()
    const updated = await useCase.execute({
      post: original,
      content: [{ platform: Platform.LINKEDIN, text: 'New text' }],
    })

    expect(updated.id).toBe(original.id)
    expect(updated.status).toBe(original.status)
    expect(updated.scheduledAt).toEqual(original.scheduledAt)
  })

  it('bumps updatedAt', async () => {
    const original = makePost({ updatedAt: new Date('2020-01-01T00:00:00.000Z') })
    const updated = await useCase.execute({
      post: original,
      content: [{ platform: Platform.LINKEDIN, text: 'New text' }],
    })

    expect(updated.updatedAt.getTime()).toBeGreaterThan(original.updatedAt.getTime())
  })

  it('saves the updated post to the repository', async () => {
    await useCase.execute({
      post: makePost(),
      content: [{ platform: Platform.LINKEDIN, text: 'New text' }],
    })

    expect(postRepo.save).toHaveBeenCalledTimes(1)
  })

  it('throws when text exceeds platform character limit', async () => {
    const longText = 'a'.repeat(281)
    await expect(
      useCase.execute({
        post: makePost(),
        content: [{ platform: Platform.TWITTER, text: longText }],
      }),
    ).rejects.toThrow('exceeds 280 characters')
  })

  it('supports multiple platforms', async () => {
    const updated = await useCase.execute({
      post: makePost(),
      content: [
        { platform: Platform.LINKEDIN, text: 'LinkedIn text' },
        { platform: Platform.TWITTER, text: 'Twitter text' },
      ],
    })

    expect(updated.content).toHaveLength(2)
  })

  it('updates imageStoragePaths when provided', async () => {
    const updated = await useCase.execute({
      post: makePost({ imageStoragePaths: ['old.jpg'] }),
      content: [{ platform: Platform.LINKEDIN, text: 'New text' }],
      imageStoragePaths: ['new-1.jpg', 'new-2.jpg'],
    })

    expect(updated.imageStoragePaths).toEqual(['new-1.jpg', 'new-2.jpg'])
  })

  it('preserves imageStoragePaths when not provided', async () => {
    const updated = await useCase.execute({
      post: makePost({ imageStoragePaths: ['kept.jpg'] }),
      content: [{ platform: Platform.LINKEDIN, text: 'New text' }],
    })

    expect(updated.imageStoragePaths).toEqual(['kept.jpg'])
  })

  it('updates scheduledAt when provided', async () => {
    const newDate = new Date('2026-08-01T15:00:00.000Z')
    const updated = await useCase.execute({
      post: makePost(),
      content: [{ platform: Platform.LINKEDIN, text: 'New text' }],
      scheduledAt: newDate,
    })

    expect(updated.scheduledAt).toEqual(newDate)
    expect(updated.status).toBe('scheduled')
  })

  it('clears scheduledAt and status when scheduledAt is set to null', async () => {
    const updated = await useCase.execute({
      post: makePost(),
      content: [{ platform: Platform.LINKEDIN, text: 'New text' }],
      scheduledAt: null,
    })

    expect(updated.scheduledAt).toBeNull()
    expect(updated.status).toBe('draft')
  })
})
