import { randomUUID } from 'node:crypto'
import {
  ALL_PLATFORMS,
  type TranslatorPort,
  type ThumbnailFetcherPort,
  type AudienceSignalRepository,
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

export function buildRationale(matchedThemes: string[], avgEngagementRate: number): string {
  if (matchedThemes.length === 0) {
    return 'Notícia verificada para o segmento da marca, sem correspondência direta com temas recorrentes.'
  }
  return `Casa com os temas recorrentes da marca: ${matchedThemes.join(', ')}. Engajamento médio da audiência: ${(avgEngagementRate * 100).toFixed(1)}%.`
}

export async function buildTopicSuggestion(
  thumbnailFetcher: ThumbnailFetcherPort,
  brandId: string,
  item: VerifiedNewsItem,
  translated: TranslatedText,
  recurringThemes: string[],
  avgEngagementRate: number,
): Promise<TopicSuggestion> {
  const haystack = `${translated.title} ${translated.summary}`.toLowerCase()
  const matchedThemes = recurringThemes.filter((theme) => haystack.includes(theme))
  const audienceFitScore = matchedThemes.length * (1 + avgEngagementRate)
  const thumbnailUrl = await thumbnailFetcher.fetchThumbnail(item.articleUrl, item.sourceUrl)

  return {
    id: randomUUID(),
    brandId,
    headline: translated.title,
    summary: translated.summary,
    sourceUrl: item.sourceUrl,
    sourceDomain: item.sourceDomain,
    rationale: buildRationale(matchedThemes, avgEngagementRate),
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
