import {
  type NewsSourcePort,
  type TopicQueryPlannerPort,
  type TranslatorPort,
  type ThumbnailFetcherPort,
  type BrandProfileRepository,
  type AudienceSignalRepository,
  type TopicSuggestionRepository,
  type BrandProfile,
  type NewsItem,
  type TopicSuggestion,
  type VerifiedNewsItem,
} from '@socialshelf/domain'
import { verifyNewsItem } from '../lib/factVerification.js'
import { translateNewsItems, buildTopicSuggestion, computeAvgEngagementRate } from '../lib/newsSuggestionBuilder.js'

// Idioma de destino da pauta. Fixo por ora (não há locale por marca ainda) — ver decisão registrada
// com o usuário. A busca é global/inglês; a UI é exibida traduzida para este idioma.
const TARGET_LANGUAGE = 'português do Brasil'

export class SuggestTopicsUseCase {
  constructor(
    private readonly newsSource: NewsSourcePort,
    private readonly queryPlanner: TopicQueryPlannerPort,
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

    const queries = await this.planQueries(brandProfile)
    // allSettled, não all: cada categoria busca em paralelo, mas o Google News pode falhar (rate
    // limit, timeout) numa categoria isolada — isso não deve derrubar a pauta inteira quando as
    // outras categorias trouxeram notícia.
    const newsResults = await Promise.allSettled(queries.map((query) => this.newsSource.fetchNews(query)))
    const rawNewsLists = newsResults
      .filter((result): result is PromiseFulfilledResult<NewsItem[]> => result.status === 'fulfilled')
      .map((result) => result.value)
    const rawNews = dedupeByUrl(rawNewsLists.flat())
    const verifiedNews = rawNews
      .map((item) => verifyNewsItem(item, this.trustedDomains))
      .filter((item): item is VerifiedNewsItem => item !== null)

    const avgEngagementRate = await computeAvgEngagementRate(this.audienceSignalRepo, brandId)
    const recurringThemes = brandProfile.narrative.recurringThemes.map((theme) => theme.toLowerCase())

    // Traduzimos antes de pontuar: os temas recorrentes da marca estão no idioma do usuário, mas a
    // notícia chega em inglês — o match de aderência precisa rodar sobre o texto já traduzido.
    const translated = await translateNewsItems(this.translator, verifiedNews, TARGET_LANGUAGE)

    const suggestions = await Promise.all(
      verifiedNews.map((item, i) =>
        buildTopicSuggestion(this.thumbnailFetcher, brandId, item, translated[i]!, recurringThemes, avgEngagementRate),
      ),
    )

    suggestions.sort((a, b) => b.audienceFitScore - a.audienceFitScore)

    for (const suggestion of suggestions) {
      await this.topicSuggestionRepo.save(suggestion)
    }

    return suggestions
  }

  // Amplia a busca além do segmento literal da marca (ex.: LegalTech também busca IA/tecnologia).
  // Se o planejador falhar, degrada para o segmento puro em vez de travar a pauta inteira.
  private async planQueries(brandProfile: BrandProfile): Promise<string[]> {
    try {
      const queries = await this.queryPlanner.planQueries({
        business: brandProfile.business,
        recurringThemes: brandProfile.narrative.recurringThemes,
      })
      return queries.length > 0 ? queries : [brandProfile.business.segment]
    } catch {
      return [brandProfile.business.segment]
    }
  }
}

// Categorias diferentes podem trazer o mesmo artigo (ex.: "legal tech" e "artificial intelligence"
// ambas retornando a mesma notícia) — dedupe por sourceUrl antes de verificar/pontuar.
function dedupeByUrl(items: NewsItem[]): NewsItem[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    if (seen.has(item.sourceUrl)) return false
    seen.add(item.sourceUrl)
    return true
  })
}
