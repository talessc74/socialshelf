import {
  type NewsSourcePort,
  type TranslatorPort,
  type ThumbnailFetcherPort,
  type AudienceFitScorerPort,
  type BrandProfileRepository,
  type AudienceSignalRepository,
  type TopicSuggestion,
  type VerifiedNewsItem,
} from '@socialshelf/domain'
import { verifyNewsItem } from '../lib/factVerification.js'
import {
  translateNewsItems,
  scoreAudienceFit,
  buildTopicSuggestion,
  computeAvgEngagementRate,
} from '../lib/newsSuggestionBuilder.js'

const TARGET_LANGUAGE = 'português do Brasil'

// Busca manual: o usuário já sabe da notícia e digita a query — diferente da pauta automática,
// não amplia categorias nem persiste resultado (são efêmeros, existem só para a tela de busca).
export class SearchNewsUseCase {
  constructor(
    private readonly newsSource: NewsSourcePort,
    private readonly translator: TranslatorPort,
    private readonly thumbnailFetcher: ThumbnailFetcherPort,
    private readonly audienceFitScorer: AudienceFitScorerPort,
    private readonly brandProfileRepo: BrandProfileRepository,
    private readonly audienceSignalRepo: AudienceSignalRepository,
    private readonly trustedDomains: string[],
  ) {}

  async execute(brandId: string, query: string): Promise<TopicSuggestion[]> {
    const brandProfile = await this.brandProfileRepo.findLatestByBrand(brandId, brandId)
    if (!brandProfile) throw new Error(`No brand profile for brand ${brandId}`)

    const rawNews = await this.newsSource.fetchNews(query)
    const verifiedNews = rawNews
      .map((item) => verifyNewsItem(item, this.trustedDomains))
      .filter((item): item is VerifiedNewsItem => item !== null)

    const avgEngagementRate = await computeAvgEngagementRate(this.audienceSignalRepo, brandId, brandId)

    const translated = await translateNewsItems(this.translator, verifiedNews, TARGET_LANGUAGE)
    const fitResults = await scoreAudienceFit(
      this.audienceFitScorer,
      brandProfile.business,
      brandProfile.narrative.recurringThemes,
      translated,
    )

    const suggestions = await Promise.all(
      verifiedNews.map((item, i) =>
        buildTopicSuggestion(this.thumbnailFetcher, brandId, item, translated[i]!, fitResults[i]!, avgEngagementRate),
      ),
    )

    suggestions.sort((a, b) => b.audienceFitScore - a.audienceFitScore)

    return suggestions
  }
}
