import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ComputeAudienceSignalUseCase } from './ComputeAudienceSignalUseCase.js'
import { Platform } from '@socialshelf/domain'
import type {
  Post,
  OAuthConnection,
  OAuthRepository,
  PostRepository,
  AnalyticsReaderPort,
  AudienceSignalRepository,
} from '@socialshelf/domain'

function makePost(externalId: string | undefined): Post {
  return {
    id: 'post-1',
    userId: 'user-1',
    brandId: 'brand-1',
    brandProfileVersion: null,
    content: [{ platform: Platform.LINKEDIN, text: 'Hello', charCount: 5 }],
    imageStoragePaths: [],
    status: 'published',
    scheduledAt: null,
    publishedAt: new Date(),
    externalIds: externalId ? { [Platform.LINKEDIN]: externalId } : {},
    sourceArticleUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

function makeConnection(): OAuthConnection {
  return {
    id: 'conn-li',
    userId: 'user-1',
    brandId: 'brand-1',
    platform: Platform.LINKEDIN,
    pairwiseId: 'pairwise-li',
    tokenRef: 'token-ref-li',
    scopes: [],
    expiresAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

describe('ComputeAudienceSignalUseCase', () => {
  let postRepo: PostRepository
  let oauthRepo: OAuthRepository
  let audienceSignalRepo: AudienceSignalRepository
  let liReader: AnalyticsReaderPort
  let useCase: ComputeAudienceSignalUseCase

  beforeEach(() => {
    postRepo = {
      save: vi.fn(),
      findById: vi.fn(),
      findByIdAndBrand: vi.fn(),
      findByBrand: vi.fn().mockResolvedValue([makePost('urn:li:share:1'), makePost('urn:li:share:2')]),
      findScheduledBefore: vi.fn(),
      delete: vi.fn(),
    }

    oauthRepo = {
      save: vi.fn(),
      findById: vi.fn(),
      findByPairwise: vi.fn(),
      findByBrandAndPlatform: vi.fn().mockResolvedValue(makeConnection()),
      findByBrand: vi.fn(),
      delete: vi.fn(),
    }

    audienceSignalRepo = {
      save: vi.fn().mockResolvedValue(undefined),
      findLatestByBrandAndPlatform: vi.fn(),
    }

    liReader = {
      fetchPostMetrics: vi
        .fn()
        .mockResolvedValueOnce({ impressions: 100, likes: 10, comments: 2, shares: 1 })
        .mockResolvedValueOnce({ impressions: 200, likes: 20, comments: 4, shares: 2 }),
    }

    const readers = new Map([[Platform.LINKEDIN, liReader]])
    useCase = new ComputeAudienceSignalUseCase(postRepo, oauthRepo, audienceSignalRepo, readers)
  })

  it('throws when no reader is registered for the platform', async () => {
    await expect(useCase.execute('brand-1', Platform.TWITTER)).rejects.toThrow(
      'No analytics reader registered for twitter',
    )
  })

  it('throws when no OAuth connection exists', async () => {
    vi.mocked(oauthRepo.findByBrandAndPlatform).mockResolvedValueOnce(null)

    await expect(useCase.execute('brand-1', Platform.LINKEDIN)).rejects.toThrow(
      'No OAuth connection for linkedin',
    )
  })

  it('aggregates metrics only across posts with an externalId for the platform', async () => {
    vi.mocked(postRepo.findByBrand).mockResolvedValueOnce([
      makePost('urn:li:share:1'),
      makePost(undefined),
      makePost('urn:li:share:2'),
    ])

    const result = await useCase.execute('brand-1', Platform.LINKEDIN)

    expect(liReader.fetchPostMetrics).toHaveBeenCalledTimes(2)
    expect(result.postsAnalyzed).toBe(2)
  })

  it('sums impressions and engagements across analyzed posts', async () => {
    const result = await useCase.execute('brand-1', Platform.LINKEDIN)

    expect(result.totalImpressions).toBe(300)
    expect(result.totalEngagements).toBe(39)
  })

  it('computes avgEngagementRate as engagements over impressions', async () => {
    const result = await useCase.execute('brand-1', Platform.LINKEDIN)

    expect(result.avgEngagementRate).toBeCloseTo(39 / 300)
  })

  it('returns avgEngagementRate of 0 when there are no impressions', async () => {
    vi.mocked(postRepo.findByBrand).mockResolvedValueOnce([])

    const result = await useCase.execute('brand-1', Platform.LINKEDIN)

    expect(result.avgEngagementRate).toBe(0)
    expect(result.postsAnalyzed).toBe(0)
  })

  it('persists the computed signal via the repository', async () => {
    const result = await useCase.execute('brand-1', Platform.LINKEDIN)

    expect(audienceSignalRepo.save).toHaveBeenCalledTimes(1)
    expect(vi.mocked(audienceSignalRepo.save).mock.calls[0]![1]).toEqual(result)
  })

  it('never persists raw per-post metrics — only the aggregate', async () => {
    await useCase.execute('brand-1', Platform.LINKEDIN)

    const saved = vi.mocked(audienceSignalRepo.save).mock.calls[0]![1]
    expect(saved).not.toHaveProperty('posts')
    expect(saved).not.toHaveProperty('rawMetrics')
  })
})
