import { randomUUID } from 'node:crypto'
import {
  ALL_PLATFORMS,
  type NewsSourcePort,
  type TranslatorPort,
  type ThumbnailFetcherPort,
  type BrandProfileRepository,
  type AudienceSignalRepository,
  type TopicSuggestionRepository,
  type TopicSuggestion,
  type VerifiedNewsItem,
} from '@socialshelf/domain'
import { verifyNewsItem } from '../lib/factVerification.js'

// Idioma de destino da pauta. Fixo por ora (não há locale por marca ainda) — ver decisão registrada
// com o usuário. A busca é global/inglês; a UI é exibida traduzida para este idioma.
const TARGET_LANGUAGE = 'português do Brasil'

interface TranslatedText {
  title: string
  summary: string
}

export class SuggestTopicsUseCase {
  constructor(
    private readonly newsSource: NewsSourcePort,
    private readonly translator: TranslatorPort,
    private readonly thumbnailFetcher: ThumbnailFetcherPort,
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

    // Traduzimos antes de pontuar: os temas recorrentes da marca estão no idioma do usuário, mas a
    // notícia chega em inglês — o match de aderência precisa rodar sobre o texto já traduzido.
    const translated = await this.translateItems(verifiedNews)

    const suggestions = await Promise.all(
      verifiedNews.map((item, i) =>
        this.buildSuggestion(brandId, item, translated[i]!, recurringThemes, avgEngagementRate),
      ),
    )

    suggestions.sort((a, b) => b.audienceFitScore - a.audienceFitScore)

    for (const suggestion of suggestions) {
      await this.topicSuggestionRepo.save(suggestion)
    }

    return suggestions
  }

  // Traduz manchetes + resumos numa única chamada. Se a tradução falhar, degrada para o texto
  // original (inglês) em vez de derrubar a pauta inteira — notícia em inglês é melhor que nenhuma.
  private async translateItems(items: VerifiedNewsItem[]): Promise<TranslatedText[]> {
    if (items.length === 0) return []

    const flat = items.flatMap((item) => [item.title, item.summary])
    try {
      const out = await this.translator.translate({ texts: flat, targetLanguage: TARGET_LANGUAGE })
      return items.map((item, i) => ({
        title: out[2 * i] ?? item.title,
        summary: out[2 * i + 1] ?? item.summary,
      }))
    } catch {
      return items.map((item) => ({ title: item.title, summary: item.summary }))
    }
  }

  private async computeAvgEngagementRate(brandId: string): Promise<number> {
    const signals = await Promise.all(
      ALL_PLATFORMS.map((platform) => this.audienceSignalRepo.findLatestByBrandAndPlatform(brandId, platform)),
    )
    const rates = signals.filter((signal) => signal !== null).map((signal) => signal!.avgEngagementRate)
    if (rates.length === 0) return 0
    return rates.reduce((sum, rate) => sum + rate, 0) / rates.length
  }

  private async buildSuggestion(
    brandId: string,
    item: VerifiedNewsItem,
    translated: TranslatedText,
    recurringThemes: string[],
    avgEngagementRate: number,
  ): Promise<TopicSuggestion> {
    const haystack = `${translated.title} ${translated.summary}`.toLowerCase()
    const matchedThemes = recurringThemes.filter((theme) => haystack.includes(theme))
    const audienceFitScore = matchedThemes.length * (1 + avgEngagementRate)
    const thumbnailUrl = await this.thumbnailFetcher.fetchThumbnail(item.articleUrl, item.sourceUrl)

    return {
      id: randomUUID(),
      brandId,
      headline: translated.title,
      summary: translated.summary,
      sourceUrl: item.sourceUrl,
      sourceDomain: item.sourceDomain,
      rationale: this.buildRationale(matchedThemes, avgEngagementRate),
      audienceFitScore,
      thumbnailUrl,
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
