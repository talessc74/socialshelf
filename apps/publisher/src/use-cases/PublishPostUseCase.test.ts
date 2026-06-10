import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PublishPostUseCase } from './PublishPostUseCase.js'
import { Platform } from '@socialshelf/domain'
import type {
  Post,
  OAuthConnection,
  OAuthRepository,
  PostRepository,
  TokenVaultPort,
  PublisherPort,
} from '@socialshelf/domain'

function makePost(platforms: Platform[]): Post {
  return {
    id: 'post-1',
    userId: 'user-1',
    brandId: 'brand-1',
    content: platforms.map((p) => ({ platform: p, text: `Text for ${p}`, charCount: 10 })),
    imageStoragePaths: [],
    status: 'scheduled',
    scheduledAt: null,
    publishedAt: null,
    externalIds: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

function makeConnection(platform: Platform): OAuthConnection {
  return {
    id: `conn-${platform}`,
    userId: 'user-1',
    brandId: 'brand-1',
    platform,
    pairwiseId: `pairwise-${platform}`,
    tokenRef: `token-ref-${platform}`,
    scopes: [],
    expiresAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

describe('PublishPostUseCase', () => {
  let postRepo: PostRepository
  let oauthRepo: OAuthRepository
  let tokenVault: TokenVaultPort
  let liPublisher: PublisherPort
  let xPublisher: PublisherPort
  let useCase: PublishPostUseCase

  beforeEach(() => {
    postRepo = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn().mockResolvedValue(makePost([Platform.LINKEDIN])),
      findByBrand: vi.fn(),
      findScheduledBefore: vi.fn(),
      delete: vi.fn(),
    }

    oauthRepo = {
      save: vi.fn(),
      findById: vi.fn(),
      findByPairwise: vi.fn(),
      findByBrandAndPlatform: vi
        .fn()
        .mockImplementation((_, platform) => Promise.resolve(makeConnection(platform))),
      findByBrand: vi.fn(),
      delete: vi.fn(),
    }

    tokenVault = {
      store: vi.fn(),
      retrieve: vi.fn().mockResolvedValue(JSON.stringify({ access_token: 'tok' })),
      delete: vi.fn(),
    }

    liPublisher = {
      publish: vi.fn().mockResolvedValue({
        externalId: 'urn:li:ugcPost:111',
        publishedAt: new Date(),
      }),
    }

    xPublisher = {
      publish: vi.fn().mockResolvedValue({
        externalId: 'tweet-999',
        publishedAt: new Date(),
      }),
    }

    const publishers = new Map([
      [Platform.LINKEDIN, liPublisher],
      [Platform.TWITTER, xPublisher],
    ])

    useCase = new PublishPostUseCase(postRepo, oauthRepo, tokenVault, publishers)
  })

  it('throws when post is not found', async () => {
    vi.mocked(postRepo.findById).mockResolvedValueOnce(null)
    await expect(useCase.execute('missing-post', 'brand-1')).rejects.toThrow('Post not found')
  })

  it('publishes to all platforms in post.content', async () => {
    vi.mocked(postRepo.findById).mockResolvedValueOnce(
      makePost([Platform.LINKEDIN, Platform.TWITTER]),
    )

    const result = await useCase.execute('post-1', 'brand-1')

    expect(result.results).toHaveLength(2)
    expect(liPublisher.publish).toHaveBeenCalledTimes(1)
    expect(xPublisher.publish).toHaveBeenCalledTimes(1)
  })

  it('marks post as published and sets publishedAt', async () => {
    await useCase.execute('post-1', 'brand-1')

    const saved = vi.mocked(postRepo.save).mock.calls[0]![0]
    expect(saved.status).toBe('published')
    expect(saved.publishedAt).toBeInstanceOf(Date)
  })

  it('stores externalId in post.externalIds for each platform', async () => {
    vi.mocked(postRepo.findById).mockResolvedValueOnce(
      makePost([Platform.LINKEDIN, Platform.TWITTER]),
    )

    await useCase.execute('post-1', 'brand-1')

    const saved = vi.mocked(postRepo.save).mock.calls[0]![0]
    expect(saved.externalIds[Platform.LINKEDIN]).toBe('urn:li:ugcPost:111')
    expect(saved.externalIds[Platform.TWITTER]).toBe('tweet-999')
  })

  it('records failed platform without throwing when publisher errors', async () => {
    vi.mocked(liPublisher.publish).mockRejectedValueOnce(new Error('API down'))

    const result = await useCase.execute('post-1', 'brand-1')

    expect(result.failedPlatforms).toHaveLength(1)
    expect(result.failedPlatforms[0]!.platform).toBe(Platform.LINKEDIN)
    expect(result.failedPlatforms[0]!.reason).toBe('API down')
  })

  it('marks post as failed when all platforms fail', async () => {
    vi.mocked(liPublisher.publish).mockRejectedValueOnce(new Error('API down'))

    await useCase.execute('post-1', 'brand-1')

    const saved = vi.mocked(postRepo.save).mock.calls[0]![0]
    expect(saved.status).toBe('failed')
    expect(saved.publishedAt).toBeNull()
  })

  it('records failed platform when no OAuth connection exists', async () => {
    vi.mocked(oauthRepo.findByBrandAndPlatform).mockResolvedValueOnce(null)

    const result = await useCase.execute('post-1', 'brand-1')

    expect(result.failedPlatforms).toHaveLength(1)
    expect(result.failedPlatforms[0]!.reason).toContain('No OAuth connection')
  })

  it('records failed platform when no publisher is registered', async () => {
    vi.mocked(postRepo.findById).mockResolvedValueOnce(makePost([Platform.FACEBOOK]))

    const result = await useCase.execute('post-1', 'brand-1')

    expect(result.failedPlatforms).toHaveLength(1)
    expect(result.failedPlatforms[0]!.reason).toContain('No publisher registered')
  })
})
