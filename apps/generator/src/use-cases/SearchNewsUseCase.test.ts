import { describe, it, expect, vi } from 'vitest'
import { SearchNewsUseCase } from './SearchNewsUseCase.js'
import { Platform } from '@socialshelf/domain'
import type {
  NewsSourcePort,
  TranslatorPort,
  ThumbnailFetcherPort,
  AudienceFitScorerPort,
  BrandProfileRepository,
  AudienceSignalRepository,
  BrandProfile,
  NewsItem,
  AudienceSignal,
} from '@socialshelf/domain'

// Reproduz o comportamento de correspondência de substring usado antes da IA semântica, para que
// os testes que não exercitam a IA continuem estáveis.
const defaultScoreAudienceFit: AudienceFitScorerPort['score'] = async ({ recurringThemes, items }) =>
  items.map((item) => {
    const text = `${item.headline} ${item.summary}`.toLowerCase()
    const matchedThemes = recurringThemes.filter((theme) => text.includes(theme.toLowerCase()))
    return { matchedThemes, relevanceStrength: matchedThemes.length }
  })

const mockBrandProfile: BrandProfile = {
  id: 'profile-1',
  userId: 'brand-1',
  brandId: 'brand-1',
  version: 1,
  business: { name: 'Acme', segment: 'tecnologia', description: 'desc' },
  identity: { positioning: 'positioning', values: [] },
  visual: { primaryColor: '#000', secondaryColor: '#fff', typography: 'Inter', logoStoragePath: null },
  voice: { tone: 'casual', allowedVocabulary: [], prohibitedVocabulary: [] },
  narrative: { recurringThemes: ['inteligência artificial', 'startups'] },
  operation: { autonomyLevel: 'manual', autoPublishTopics: [], blockedTopics: [], maxAutoPostsPerDay: 1 },
  createdAt: new Date(),
}

function makeNewsItem(overrides: Partial<NewsItem> = {}): NewsItem {
  return {
    title: 'Avanço em inteligência artificial muda o mercado',
    summary: 'Resumo da notícia',
    sourceUrl: 'https://www.reuters.com/article/1',
    articleUrl: 'https://news.google.com/rss/articles/abc',
    sourceName: 'Reuters',
    publishedAt: new Date('2026-06-01T00:00:00Z'),
    ...overrides,
  }
}

function makeAudienceSignal(avgEngagementRate: number): AudienceSignal {
  return {
    id: 'signal-1',
    brandId: 'brand-1',
    platform: Platform.LINKEDIN,
    postsAnalyzed: 3,
    totalImpressions: 900,
    totalEngagements: 90,
    avgEngagementRate,
    computedAt: new Date(),
  }
}

function makeUseCase(opts: {
  newsItems?: NewsItem[]
  fetchNewsImpl?: NewsSourcePort['fetchNews']
  brandProfile?: BrandProfile | null
  avgEngagementRate?: number | null
  translate?: TranslatorPort['translate']
  fetchThumbnail?: ThumbnailFetcherPort['fetchThumbnail']
  scoreAudienceFit?: AudienceFitScorerPort['score']
}) {
  const newsSource: NewsSourcePort = {
    fetchNews: vi.fn(opts.fetchNewsImpl ?? (async () => opts.newsItems ?? [makeNewsItem()])),
  }
  const translator: TranslatorPort = {
    translate: vi.fn(opts.translate ?? (async ({ texts }) => texts)),
  }
  const thumbnailFetcher: ThumbnailFetcherPort = {
    fetchThumbnail: vi.fn(opts.fetchThumbnail ?? (async () => null)),
  }
  // Scorer literal por padrão: reproduz o comportamento de correspondência de substring usado
  // antes da IA semântica, para que os testes que não exercitam a IA continuem estáveis.
  const audienceFitScorer: AudienceFitScorerPort = {
    score: vi.fn(opts.scoreAudienceFit ?? defaultScoreAudienceFit),
  }
  const brandProfileRepo: BrandProfileRepository = {
    save: vi.fn(),
    findLatestByBrand: vi
      .fn()
      .mockResolvedValue('brandProfile' in opts ? opts.brandProfile : mockBrandProfile),
    findByBrandAndVersion: vi.fn(),
  }
  const audienceSignalRepo: AudienceSignalRepository = {
    save: vi.fn(),
    findLatestByBrandAndPlatform: vi
      .fn()
      .mockResolvedValue(opts.avgEngagementRate == null ? null : makeAudienceSignal(opts.avgEngagementRate)),
  }

  const useCase = new SearchNewsUseCase(
    newsSource,
    translator,
    thumbnailFetcher,
    audienceFitScorer,
    brandProfileRepo,
    audienceSignalRepo,
    ['reuters.com'],
  )

  return { useCase, newsSource, translator, thumbnailFetcher, audienceFitScorer, brandProfileRepo, audienceSignalRepo }
}

describe('SearchNewsUseCase', () => {
  it('throws when there is no brand profile', async () => {
    const { useCase } = makeUseCase({ brandProfile: null })

    await expect(useCase.execute('brand-1', 'inteligência artificial')).rejects.toThrow(
      'No brand profile for brand brand-1',
    )
  })

  it('searches news using the literal query typed by the user', async () => {
    const { useCase, newsSource } = makeUseCase({ avgEngagementRate: 0.1 })

    await useCase.execute('brand-1', 'inteligência artificial no varejo')

    expect(newsSource.fetchNews).toHaveBeenCalledTimes(1)
    expect(newsSource.fetchNews).toHaveBeenCalledWith('inteligência artificial no varejo')
  })

  it('discards unverified news and never suggests them', async () => {
    const { useCase } = makeUseCase({
      newsItems: [makeNewsItem({ sourceUrl: 'https://untrusted.example/post' })],
      avgEngagementRate: 0.1,
    })

    const result = await useCase.execute('brand-1', 'qualquer assunto')

    expect(result).toHaveLength(0)
  })

  it('builds a suggestion from a verified news item matching a recurring theme', async () => {
    const { useCase } = makeUseCase({ avgEngagementRate: 0.1 })

    const result = await useCase.execute('brand-1', 'inteligência artificial')

    expect(result).toHaveLength(1)
    expect(result[0]?.sourceDomain).toBe('reuters.com')
    expect(result[0]?.rationale).toContain('inteligência artificial')
    expect(result[0]?.audienceFitScore).toBeGreaterThan(0)
  })

  it('does not persist results — they are ephemeral to the search screen', async () => {
    const { useCase, brandProfileRepo } = makeUseCase({ avgEngagementRate: 0.1 })

    await useCase.execute('brand-1', 'inteligência artificial')

    expect(brandProfileRepo.save).not.toHaveBeenCalled()
  })

  it('attaches the fetched thumbnail url to the suggestion', async () => {
    const { useCase, thumbnailFetcher } = makeUseCase({
      avgEngagementRate: 0.1,
      fetchThumbnail: async () => 'https://cdn.reuters.com/cover.jpg',
    })

    const result = await useCase.execute('brand-1', 'inteligência artificial')

    expect(thumbnailFetcher.fetchThumbnail).toHaveBeenCalledWith(
      'https://news.google.com/rss/articles/abc',
      'https://www.reuters.com/article/1',
    )
    expect(result[0]?.thumbnailUrl).toBe('https://cdn.reuters.com/cover.jpg')
  })

  it('sorts suggestions by audienceFitScore descending', async () => {
    const { useCase } = makeUseCase({
      newsItems: [
        makeNewsItem({ title: 'Sem relação nenhuma', summary: 'Assunto neutro' }),
        makeNewsItem({
          title: 'Inteligência artificial e startups crescem',
          summary: 'Tema duplo',
          sourceUrl: 'https://www.reuters.com/article/2',
        }),
      ],
      avgEngagementRate: 0.1,
    })

    const result = await useCase.execute('brand-1', 'inteligência artificial')

    expect(result[0]?.audienceFitScore).toBeGreaterThanOrEqual(result[1]?.audienceFitScore ?? 0)
  })

  it('falls back to the original text when translation fails, never dropping the news', async () => {
    const { useCase } = makeUseCase({
      newsItems: [makeNewsItem({ title: 'Inteligência artificial avança', summary: 'Resumo' })],
      avgEngagementRate: 0.1,
      translate: async () => {
        throw new Error('Vertex unavailable')
      },
    })

    const result = await useCase.execute('brand-1', 'inteligência artificial')

    expect(result).toHaveLength(1)
    expect(result[0]?.headline).toBe('Inteligência artificial avança')
  })
})
