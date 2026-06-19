import { describe, it, expect, vi } from 'vitest'
import { SuggestTopicsUseCase } from './SuggestTopicsUseCase.js'
import { Platform } from '@socialshelf/domain'
import type {
  NewsSourcePort,
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
  brandProfile?: BrandProfile | null
  avgEngagementRate?: number | null
}) {
  const newsSource: NewsSourcePort = {
    fetchNews: vi.fn().mockResolvedValue(opts.newsItems ?? [makeNewsItem()]),
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
  }

  const useCase = new SuggestTopicsUseCase(
    newsSource,
    brandProfileRepo,
    audienceSignalRepo,
    topicSuggestionRepo,
    ['reuters.com'],
  )

  return { useCase, newsSource, brandProfileRepo, audienceSignalRepo, topicSuggestionRepo }
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
})
