import { describe, it, expect, vi } from 'vitest'
import { SuggestTopicsUseCase } from './SuggestTopicsUseCase.js'
import { Platform } from '@socialshelf/domain'
import type {
  NewsSourcePort,
  TopicQueryPlannerPort,
  TranslatorPort,
  ThumbnailFetcherPort,
  BrandProfileRepository,
  AudienceSignalRepository,
  TopicSuggestionRepository,
  BrandProfile,
  NewsItem,
  AudienceSignal,
} from '@socialshelf/domain'

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
  operation: { autonomyLevel: 'manual', autoPublishTopics: [], blockedTopics: [] },
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
  queries?: string[]
  planQueriesImpl?: TopicQueryPlannerPort['planQueries']
  brandProfile?: BrandProfile | null
  avgEngagementRate?: number | null
  translate?: TranslatorPort['translate']
  fetchThumbnail?: ThumbnailFetcherPort['fetchThumbnail']
}) {
  const newsSource: NewsSourcePort = {
    fetchNews: vi.fn(opts.fetchNewsImpl ?? (async () => opts.newsItems ?? [makeNewsItem()])),
  }
  // Planejador identidade por padrão: uma única query, então o comportamento de busca por
  // segmento literal (pré-existente) continua valendo nos testes que não exercitam o planejador.
  const queryPlanner: TopicQueryPlannerPort = {
    planQueries: vi.fn(opts.planQueriesImpl ?? (async () => opts.queries ?? ['tecnologia'])),
  }
  // Tradutor identidade por padrão: o texto de teste já está em português, então o match de temas
  // continua válido sem precisar de um tradutor real.
  const translator: TranslatorPort = {
    translate: vi.fn(opts.translate ?? (async ({ texts }) => texts)),
  }
  const thumbnailFetcher: ThumbnailFetcherPort = {
    fetchThumbnail: vi.fn(opts.fetchThumbnail ?? (async () => null)),
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
  const topicSuggestionRepo: TopicSuggestionRepository = {
    save: vi.fn().mockResolvedValue(undefined),
    findLatestByBrand: vi.fn().mockResolvedValue([]),
    findById: vi.fn().mockResolvedValue(null),
  }

  const useCase = new SuggestTopicsUseCase(
    newsSource,
    queryPlanner,
    translator,
    thumbnailFetcher,
    brandProfileRepo,
    audienceSignalRepo,
    topicSuggestionRepo,
    ['reuters.com'],
  )

  return {
    useCase,
    newsSource,
    queryPlanner,
    translator,
    thumbnailFetcher,
    brandProfileRepo,
    audienceSignalRepo,
    topicSuggestionRepo,
  }
}

describe('SuggestTopicsUseCase', () => {
  it('throws when there is no brand profile', async () => {
    const { useCase } = makeUseCase({ brandProfile: null })

    await expect(useCase.execute('brand-1')).rejects.toThrow('No brand profile for brand brand-1')
  })

  it('discards unverified news and never suggests them', async () => {
    const { useCase, topicSuggestionRepo } = makeUseCase({
      newsItems: [makeNewsItem({ sourceUrl: 'https://untrusted.example/post' })],
      avgEngagementRate: 0.1,
    })

    const result = await useCase.execute('brand-1')

    expect(result).toHaveLength(0)
    expect(topicSuggestionRepo.save).not.toHaveBeenCalled()
  })

  it('builds a suggestion from a verified news item matching a recurring theme', async () => {
    const { useCase } = makeUseCase({ avgEngagementRate: 0.1 })

    const result = await useCase.execute('brand-1')

    expect(result).toHaveLength(1)
    expect(result[0]?.sourceDomain).toBe('reuters.com')
    expect(result[0]?.rationale).toContain('inteligência artificial')
    expect(result[0]?.audienceFitScore).toBeGreaterThan(0)
  })

  it('gives a zero audience fit score when no recurring theme matches', async () => {
    const { useCase } = makeUseCase({
      newsItems: [makeNewsItem({ title: 'Notícia sem relação', summary: 'Outro assunto qualquer' })],
      avgEngagementRate: 0.1,
    })

    const result = await useCase.execute('brand-1')

    expect(result[0]?.audienceFitScore).toBe(0)
    expect(result[0]?.rationale).toContain('sem correspondência')
  })

  it('treats missing audience signal as zero engagement, not an error', async () => {
    const { useCase } = makeUseCase({ avgEngagementRate: null })

    const result = await useCase.execute('brand-1')

    expect(result).toHaveLength(1)
    expect(result[0]?.rationale).toContain('0.0%')
  })

  it('persists every suggestion via the repository', async () => {
    const { useCase, topicSuggestionRepo } = makeUseCase({ avgEngagementRate: 0.2 })

    await useCase.execute('brand-1')

    expect(topicSuggestionRepo.save).toHaveBeenCalledTimes(1)
  })

  it('translates headline and summary, scoring themes against the translated text', async () => {
    const { useCase, translator } = makeUseCase({
      newsItems: [
        makeNewsItem({ title: 'Artificial intelligence reshapes the market', summary: 'English summary' }),
      ],
      avgEngagementRate: 0.1,
      // Tradutor que devolve português, casando com o tema recorrente "inteligência artificial".
      translate: async ({ texts }) =>
        texts.map((t) =>
          t === 'Artificial intelligence reshapes the market'
            ? 'Inteligência artificial transforma o mercado'
            : 'Resumo em português',
        ),
    })

    const result = await useCase.execute('brand-1')

    expect(translator.translate).toHaveBeenCalledOnce()
    expect(result[0]?.headline).toBe('Inteligência artificial transforma o mercado')
    expect(result[0]?.summary).toBe('Resumo em português')
    expect(result[0]?.audienceFitScore).toBeGreaterThan(0)
    expect(result[0]?.rationale).toContain('inteligência artificial')
  })

  it('falls back to the original text when translation fails, never dropping the news', async () => {
    const { useCase } = makeUseCase({
      newsItems: [makeNewsItem({ title: 'Inteligência artificial avança', summary: 'Resumo' })],
      avgEngagementRate: 0.1,
      translate: async () => {
        throw new Error('Vertex unavailable')
      },
    })

    const result = await useCase.execute('brand-1')

    expect(result).toHaveLength(1)
    expect(result[0]?.headline).toBe('Inteligência artificial avança')
  })

  it('attaches the fetched thumbnail url to the suggestion', async () => {
    const { useCase, thumbnailFetcher } = makeUseCase({
      avgEngagementRate: 0.1,
      fetchThumbnail: async () => 'https://cdn.reuters.com/cover.jpg',
    })

    const result = await useCase.execute('brand-1')

    expect(thumbnailFetcher.fetchThumbnail).toHaveBeenCalledWith(
      'https://news.google.com/rss/articles/abc',
      'https://www.reuters.com/article/1',
    )
    expect(result[0]?.thumbnailUrl).toBe('https://cdn.reuters.com/cover.jpg')
  })

  it('leaves thumbnailUrl null when no image can be resolved', async () => {
    const { useCase } = makeUseCase({ avgEngagementRate: 0.1, fetchThumbnail: async () => null })

    const result = await useCase.execute('brand-1')

    expect(result[0]?.thumbnailUrl).toBeNull()
  })

  it('sorts suggestions by audienceFitScore descending', async () => {
    const { useCase } = makeUseCase({
      newsItems: [
        makeNewsItem({ title: 'Sem relação nenhuma', summary: 'Assunto neutro' }),
        makeNewsItem({ title: 'Inteligência artificial e startups crescem', summary: 'Tema duplo' }),
      ],
      avgEngagementRate: 0.1,
    })

    const result = await useCase.execute('brand-1')

    expect(result[0]?.audienceFitScore).toBeGreaterThanOrEqual(result[1]?.audienceFitScore ?? 0)
  })

  it('fetches news for every category planned by the query planner, not just the literal segment', async () => {
    const { useCase, newsSource, queryPlanner } = makeUseCase({
      queries: ['legal tech', 'artificial intelligence', 'startups'],
      fetchNewsImpl: async (query) => [makeNewsItem({ title: `Notícia sobre ${query}`, sourceUrl: `https://www.reuters.com/${query}` })],
      avgEngagementRate: 0.1,
    })

    const result = await useCase.execute('brand-1')

    expect(queryPlanner.planQueries).toHaveBeenCalledWith(
      expect.objectContaining({ business: mockBrandProfile.business, recurringThemes: mockBrandProfile.narrative.recurringThemes }),
    )
    expect(newsSource.fetchNews).toHaveBeenCalledTimes(3)
    expect(newsSource.fetchNews).toHaveBeenCalledWith('legal tech')
    expect(newsSource.fetchNews).toHaveBeenCalledWith('artificial intelligence')
    expect(newsSource.fetchNews).toHaveBeenCalledWith('startups')
    expect(result).toHaveLength(3)
  })

  it('deduplicates the same article returned by more than one planned category', async () => {
    const { useCase, newsSource } = makeUseCase({
      queries: ['legal tech', 'artificial intelligence'],
      fetchNewsImpl: async () => [makeNewsItem({ sourceUrl: 'https://www.reuters.com/article/1' })],
      avgEngagementRate: 0.1,
    })

    const result = await useCase.execute('brand-1')

    expect(newsSource.fetchNews).toHaveBeenCalledTimes(2)
    expect(result).toHaveLength(1)
  })

  it('falls back to the brand segment when the query planner fails, without dropping the suggestion flow', async () => {
    const { useCase, newsSource } = makeUseCase({
      planQueriesImpl: async () => {
        throw new Error('Vertex unavailable')
      },
      avgEngagementRate: 0.1,
    })

    const result = await useCase.execute('brand-1')

    expect(newsSource.fetchNews).toHaveBeenCalledTimes(1)
    expect(newsSource.fetchNews).toHaveBeenCalledWith(mockBrandProfile.business.segment)
    expect(result).toHaveLength(1)
  })
})
