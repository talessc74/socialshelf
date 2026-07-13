import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CreatePostUseCase } from './CreatePostUseCase.js'
import { Platform } from '@socialshelf/domain'
import type { PostRepository, BrandProfileRepository } from '@socialshelf/domain'

describe('CreatePostUseCase', () => {
  let postRepo: PostRepository
  let brandProfileRepo: BrandProfileRepository
  let useCase: CreatePostUseCase

  beforeEach(() => {
    postRepo = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn(),
      findByIdAndBrand: vi.fn(),
      claimForPublishing: vi.fn(),
      findByBrand: vi.fn(),
      findScheduledBefore: vi.fn(),
      delete: vi.fn(),
    }
    brandProfileRepo = {
      save: vi.fn().mockResolvedValue(undefined),
      findLatestByBrand: vi.fn().mockResolvedValue(null),
      findByBrandAndVersion: vi.fn(),
    }
    useCase = new CreatePostUseCase(postRepo, brandProfileRepo)
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

  it('snapshots brandProfileVersion as null when no brand profile exists', async () => {
    const post = await useCase.execute({
      userId: 'user-1',
      brandId: 'brand-1',
      content: [{ platform: Platform.LINKEDIN, text: 'No brand yet' }],
    })

    expect(post.brandProfileVersion).toBeNull()
  })

  it('snapshots the latest brandProfileVersion at creation time', async () => {
    vi.mocked(brandProfileRepo.findLatestByBrand).mockResolvedValue({
      id: 'profile-1',
      userId: 'user-1',
      brandId: 'brand-1',
      version: 3,
      business: { name: 'Acme', segment: 'Retail', description: '' },
      identity: { positioning: '', values: [] },
      visual: { primaryColor: '#000', secondaryColor: '#fff', typography: '', logoStoragePath: null },
      voice: { tone: '', allowedVocabulary: [], prohibitedVocabulary: [] },
      narrative: { recurringThemes: [] },
      operation: {
        autonomyLevel: 'manual',
        autoPublishTopics: [],
        blockedTopics: [],
        maxAutoPostsPerDay: 1,
        stylePreferences: [],
      },
      createdAt: new Date(),
    })

    const post = await useCase.execute({
      userId: 'user-1',
      brandId: 'brand-1',
      content: [{ platform: Platform.LINKEDIN, text: 'With brand' }],
    })

    expect(post.brandProfileVersion).toBe(3)
  })

  it('does not mutate brandProfileVersion after the post is created', async () => {
    vi.mocked(brandProfileRepo.findLatestByBrand).mockResolvedValueOnce({
      id: 'profile-1',
      userId: 'user-1',
      brandId: 'brand-1',
      version: 1,
      business: { name: 'Acme', segment: 'Retail', description: '' },
      identity: { positioning: '', values: [] },
      visual: { primaryColor: '#000', secondaryColor: '#fff', typography: '', logoStoragePath: null },
      voice: { tone: '', allowedVocabulary: [], prohibitedVocabulary: [] },
      narrative: { recurringThemes: [] },
      operation: {
        autonomyLevel: 'manual',
        autoPublishTopics: [],
        blockedTopics: [],
        maxAutoPostsPerDay: 1,
        stylePreferences: [],
      },
      createdAt: new Date(),
    })

    const post = await useCase.execute({
      userId: 'user-1',
      brandId: 'brand-1',
      content: [{ platform: Platform.LINKEDIN, text: 'v1 snapshot' }],
    })

    expect(post.brandProfileVersion).toBe(1)
  })
})
