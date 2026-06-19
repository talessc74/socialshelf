import { randomUUID } from 'node:crypto'
import {
  ALL_PLATFORMS,
  type NewsSourcePort,
  type BrandProfileRepository,
  type AudienceSignalRepository,
  type TopicSuggestionRepository,
  type TopicSuggestion,
  type VerifiedNewsItem,
} from '@socialshelf/domain'
import { verifyNewsItem } from '../lib/factVerification.js'

export class SuggestTopicsUseCase {
  constructor(
    private readonly newsSource: NewsSourcePort,
    private readonly brandProfileRepo: BrandProfileRepository,
    private readonly audienceSignalRepo: AudienceSignalRepository,
    private readonly topicSuggestionRepo: TopicSuggestionRepository,
    private readonly trustedDomains: string[],
  ) {}

  async execute(brandId: string): Promise<TopicSuggestion[]> {
    const brandProfile = await this.brandProfileRepo.findLatestByBrand(brandId)
    if (!brandProfile) throw new Error(`No brand profile for brand ${brandId}`)

    const rawNews = await this.newsSource.fetchNews(brandProfile.business.segment)
    const verifiedNews = rawNews
      .map((item) => verifyNewsItem(item, this.trustedDomains))
      .filter((item): item is VerifiedNewsItem => item !== null)

    const avgEngagementRate = await this.computeAvgEngagementRate(brandId)
    const recurringThemes = brandProfile.narrative.recurringThemes.map((theme) => theme.toLowerCase())

    const suggestions = verifiedNews.map((item) =>
      this.buildSuggestion(brandId, item, recurringThemes, avgEngagementRate),
    )

    suggestions.sort((a, b) => b.audienceFitScore - a.audienceFitScore)

    for (const suggestion of suggestions) {
      await this.topicSuggestionRepo.save(suggestion)
    }

    return suggestions
  }

  private async computeAvgEngagementRate(brandId: string): Promise<number> {
    const signals = await Promise.all(
      ALL_PLATFORMS.map((platform) => this.audienceSignalRepo.findLatestByBrandAndPlatform(brandId, platform)),
    )
    const rates = signals.filter((signal) => signal !== null).map((signal) => signal!.avgEngagementRate)
    if (rates.length === 0) return 0
    return rates.reduce((sum, rate) => sum + rate, 0) / rates.length
  }

  private buildSuggestion(
    brandId: string,
    item: VerifiedNewsItem,
    recurringThemes: string[],
    avgEngagementRate: number,
  ): TopicSuggestion {
    const haystack = `${item.title} ${item.summary}`.toLowerCase()
    const matchedThemes = recurringThemes.filter((theme) => haystack.includes(theme))
    const audienceFitScore = matchedThemes.length * (1 + avgEngagementRate)

    return {
      id: randomUUID(),
      brandId,
      headline: item.title,
      summary: item.summary,
      sourceUrl: item.sourceUrl,
      sourceDomain: item.sourceDomain,
      rationale: this.buildRationale(matchedThemes, avgEngagementRate),
      audienceFitScore,
      createdAt: new Date(),
    }
  }

  private buildRationale(matchedThemes: string[], avgEngagementRate: number): string {
    if (matchedThemes.length === 0) {
      return 'Notícia verificada para o segmento da marca, sem correspondência direta com temas recorrentes.'
    }
    return `Casa com os temas recorrentes da marca: ${matchedThemes.join(', ')}. Engajamento médio da audiência: ${(avgEngagementRate * 100).toFixed(1)}%.`
  }
}
