import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GetPostsPerformanceUseCase } from './GetPostsPerformanceUseCase.js'
import { ContentNotFoundError, Platform } from '@socialshelf/domain'
import type { Post, OAuthConnection, OAuthRepository, PostRepository, AnalyticsReaderPort } from '@socialshelf/domain'

function makePost(overrides: Partial<Post> = {}): Post {
  return {
    id: 'post-1',
    userId: 'user-1',
    brandId: 'brand-1',
    brandProfileVersion: null,
    content: [{ platform: Platform.LINKEDIN, text: 'Hello', charCount: 5 }],
    imageStoragePaths: [],
    videoStoragePath: null,
    videoConsentAcceptedAt: null,
    status: 'published',
    origin: 'manual',
    scheduledAt: null,
    publishedAt: new Date('2026-01-01T00:00:00.000Z'),
    externalIds: { [Platform.LINKEDIN]: 'urn:li:share:1' },
    sourceArticleUrl: null,
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
      claimForPublishing: vi.fn(),
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

    expect(result.entries).toHaveLength(2)
    expect(result.entries[0]!.postId).toBe('post-high')
    expect(result.entries[0]!.score).toBe(1065)
    expect(result.entries[1]!.postId).toBe('post-low')
    expect(result.errors).toEqual([])
  })

  it('ignora plataformas sem leitor de analytics registrado', async () => {
    vi.mocked(postRepo.findByBrand).mockResolvedValueOnce([
      makePost({ externalIds: { [Platform.TWITTER]: 'tweet-1' } }),
    ])

    const result = await useCase.execute('brand-1')

    expect(result.entries).toHaveLength(0)
  })

  it('ignora plataformas sem conexão OAuth ativa', async () => {
    vi.mocked(oauthRepo.findByBrandAndPlatform).mockResolvedValueOnce(null)

    const result = await useCase.execute('brand-1')

    expect(result.entries).toHaveLength(0)
    expect(liReader.fetchPostMetrics).not.toHaveBeenCalled()
  })

  it('inclui o texto do conteúdo correspondente à plataforma', async () => {
    const result = await useCase.execute('brand-1')

    expect(result.entries[0]!.text).toBe('Hello')
  })

  it('retorna lista vazia quando não há posts publicados', async () => {
    vi.mocked(postRepo.findByBrand).mockResolvedValueOnce([])

    const result = await useCase.execute('brand-1')

    expect(result.entries).toEqual([])
    expect(result.errors).toEqual([])
  })

  it('isola falha de uma plataforma sem afetar as demais', async () => {
    const fbReader: AnalyticsReaderPort = {
      fetchPostMetrics: vi.fn().mockRejectedValue(new Error('Meta token expired')),
    }
    const readers = new Map([
      [Platform.LINKEDIN, liReader],
      [Platform.FACEBOOK, fbReader],
    ])
    useCase = new GetPostsPerformanceUseCase(postRepo, oauthRepo, readers)

    vi.mocked(postRepo.findByBrand).mockResolvedValueOnce([
      makePost({
        externalIds: {
          [Platform.LINKEDIN]: 'urn:li:share:1',
          [Platform.FACEBOOK]: 'fb-post-1',
        },
      }),
    ])

    const result = await useCase.execute('brand-1')

    expect(result.entries).toHaveLength(1)
    expect(result.entries[0]!.platform).toBe(Platform.LINKEDIN)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]!.platform).toBe(Platform.FACEBOOK)
    expect(result.errors[0]!.message).toBe('Meta token expired')
  })

  it('limpa o externalId e não reporta erro quando o conteúdo foi apagado na plataforma', async () => {
    const igReader: AnalyticsReaderPort = {
      fetchPostMetrics: vi.fn().mockRejectedValue(new ContentNotFoundError('Instagram media gone')),
    }
    const readers = new Map([[Platform.INSTAGRAM, igReader]])
    useCase = new GetPostsPerformanceUseCase(postRepo, oauthRepo, readers)

    const post = makePost({
      externalIds: { [Platform.INSTAGRAM]: 'media-deleted' },
      content: [{ platform: Platform.INSTAGRAM, text: 'Hello', charCount: 5 }],
    })
    vi.mocked(postRepo.findByBrand).mockResolvedValueOnce([post])

    const result = await useCase.execute('brand-1')

    expect(result.entries).toHaveLength(0)
    expect(result.errors).toHaveLength(0)
    expect(postRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ externalIds: {} }),
    )
  })
})
