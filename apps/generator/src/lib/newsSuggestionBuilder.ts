import { randomUUID } from 'node:crypto'
import {
  ALL_PLATFORMS,
  type TranslatorPort,
  type ThumbnailFetcherPort,
  type AudienceFitScorerPort,
  type AudienceFitResult,
  type AudienceSignalRepository,
  type BrandProfileBusiness,
  type TopicSuggestion,
  type VerifiedNewsItem,
} from '@socialshelf/domain'

export interface TranslatedText {
  title: string
  summary: string
}

// Traduz manchetes + resumos numa única chamada. Se a tradução falhar, degrada para o texto
// original (inglês) em vez de derrubar a pauta inteira — notícia em inglês é melhor que nenhuma.
export async function translateNewsItems(
  translator: TranslatorPort,
  items: VerifiedNewsItem[],
  targetLanguage: string,
): Promise<TranslatedText[]> {
  if (items.length === 0) return []

  const flat = items.flatMap((item) => [item.title, item.summary])
  try {
    const out = await translator.translate({ texts: flat, targetLanguage })
    return items.map((item, i) => ({
      title: out[2 * i] ?? item.title,
      summary: out[2 * i + 1] ?? item.summary,
    }))
  } catch {
    return items.map((item) => ({ title: item.title, summary: item.summary }))
  }
}

// Avalia a aderência de cada notícia ao negócio da marca numa única chamada. A IA julga relevância
// semântica, não apenas correspondência literal com os temas recorrentes — uma notícia sobre "IA
// vence causa no Reino Unido" deve pontuar para uma LegalTech de IA mesmo sem citar nenhuma palavra
// exata do cadastro. Se a IA falhar, degrada para relevância zero em vez de derrubar a pauta inteira.
export async function scoreAudienceFit(
  scorer: AudienceFitScorerPort,
  business: BrandProfileBusiness,
  recurringThemes: string[],
  items: TranslatedText[],
): Promise<AudienceFitResult[]> {
  if (items.length === 0) return []

  try {
    return await scorer.score({
      business,
      recurringThemes,
      items: items.map((item) => ({ headline: item.title, summary: item.summary })),
    })
  } catch {
    return items.map(() => ({ matchedThemes: [], relevanceStrength: 0 }))
  }
}

export function buildRationale(fit: AudienceFitResult, avgEngagementRate: number): string {
  if (fit.matchedThemes.length > 0) {
    return `Casa com os temas recorrentes da marca: ${fit.matchedThemes.join(', ')}. Engajamento médio da audiência: ${(avgEngagementRate * 100).toFixed(1)}%.`
  }
  if (fit.relevanceStrength > 0) {
    return `A IA avaliou esta notícia como relevante para o negócio da marca, mesmo sem casar literalmente com os temas recorrentes cadastrados. Engajamento médio da audiência: ${(avgEngagementRate * 100).toFixed(1)}%.`
  }
  return 'Notícia verificada para o segmento da marca, sem correspondência direta com temas recorrentes.'
}

export async function buildTopicSuggestion(
  thumbnailFetcher: ThumbnailFetcherPort,
  brandId: string,
  item: VerifiedNewsItem,
  translated: TranslatedText,
  fit: AudienceFitResult,
  avgEngagementRate: number,
): Promise<TopicSuggestion> {
  const audienceFitScore = fit.relevanceStrength * (1 + avgEngagementRate)
  const thumbnailUrl = await thumbnailFetcher.fetchThumbnail(item.articleUrl, item.sourceUrl)

  return {
    id: randomUUID(),
    brandId,
    headline: translated.title,
    summary: translated.summary,
    sourceUrl: item.sourceUrl,
    sourceDomain: item.sourceDomain,
    articleUrl: item.articleUrl,
    rationale: buildRationale(fit, avgEngagementRate),
    audienceFitScore,
    thumbnailUrl,
    createdAt: new Date(),
  }
}

export async function computeAvgEngagementRate(
  audienceSignalRepo: AudienceSignalRepository,
  brandId: string,
): Promise<number> {
  const signals = await Promise.all(
    ALL_PLATFORMS.map((platform) => audienceSignalRepo.findLatestByBrandAndPlatform(brandId, platform)),
  )
  const rates = signals.filter((signal) => signal !== null).map((signal) => signal!.avgEngagementRate)
  if (rates.length === 0) return 0
  return rates.reduce((sum, rate) => sum + rate, 0) / rates.length
}
