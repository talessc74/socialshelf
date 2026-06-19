import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GetPostsPerformanceUseCase } from './GetPostsPerformanceUseCase.js'
import { Platform } from '@socialshelf/domain'
import type { Post, OAuthConnection, OAuthRepository, PostRepository, AnalyticsReaderPort } from '@socialshelf/domain'

function makePost(overrides: Partial<Post> = {}): Post {
  return {
    id: 'post-1',
    userId: 'user-1',
    brandId: 'brand-1',
    brandProfileVersion: null,
    content: [{ platform: Platform.LINKEDIN, text: 'Hello', charCount: 5 }],
    imageStoragePaths: [],
    status: 'published',
    scheduledAt: null,
    publishedAt: new Date('2026-01-01T00:00:00.000Z'),
    externalIds: { [Platform.LINKEDIN]: 'urn:li:share:1' },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
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

describe('GetPostsPerformanceUseCase', () => {
  let postRepo: PostRepository
  let oauthRepo: OAuthRepository
  let liReader: AnalyticsReaderPort
  let useCase: GetPostsPerformanceUseCase

  beforeEach(() => {
    postRepo = {
      save: vi.fn(),
      findById: vi.fn(),
      findByIdAndBrand: vi.fn(),
      findByBrand: vi.fn().mockResolvedValue([makePost()]),
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

    liReader = {
      fetchPostMetrics: vi.fn().mockResolvedValue({ impressions: 100, likes: 10, comments: 2, shares: 1 }),
    }

    const readers = new Map([[Platform.LINKEDIN, liReader]])
    useCase = new GetPostsPerformanceUseCase(postRepo, oauthRepo, readers)
  })

  it('retorna uma entrada por (post, plataforma com externalId) ordenada por score desc', async () => {
    vi.mocked(postRepo.findByBrand).mockResolvedValueOnce([
      makePost({ id: 'post-low', externalIds: { [Platform.LINKEDIN]: 'urn:li:share:low' } }),
      makePost({ id: 'post-high', externalIds: { [Platform.LINKEDIN]: 'urn:li:share:high' } }),
    ])
    vi.mocked(liReader.fetchPostMetrics)
      .mockResolvedValueOnce({ impressions: 10, likes: 1, comments: 0, shares: 0 })
      .mockResolvedValueOnce({ impressions: 1000, likes: 50, comments: 10, shares: 5 })

    const result = await useCase.execute('brand-1')

    expect(result).toHaveLength(2)
    expect(result[0]!.postId).toBe('post-high')
    expect(result[0]!.score).toBe(1065)
    expect(result[1]!.postId).toBe('post-low')
  })

  it('ignora plataformas sem leitor de analytics registrado', async () => {
    vi.mocked(postRepo.findByBrand).mockResolvedValueOnce([
      makePost({ externalIds: { [Platform.TWITTER]: 'tweet-1' } }),
    ])

    const result = await useCase.execute('brand-1')

    expect(result).toHaveLength(0)
  })

  it('ignora plataformas sem conexão OAuth ativa', async () => {
    vi.mocked(oauthRepo.findByBrandAndPlatform).mockResolvedValueOnce(null)

    const result = await useCase.execute('brand-1')

    expect(result).toHaveLength(0)
    expect(liReader.fetchPostMetrics).not.toHaveBeenCalled()
  })

  it('inclui o texto do conteúdo correspondente à plataforma', async () => {
    const result = await useCase.execute('brand-1')

    expect(result[0]!.text).toBe('Hello')
  })

  it('retorna lista vazia quando não há posts publicados', async () => {
    vi.mocked(postRepo.findByBrand).mockResolvedValueOnce([])

    const result = await useCase.execute('brand-1')

    expect(result).toEqual([])
  })
})
