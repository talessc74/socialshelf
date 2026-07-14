import type { ApiPostPerformanceEntry } from './api'
import { PLATFORM_META } from './platformMeta'

function engagementRate(entry: ApiPostPerformanceEntry): number {
  const { impressions, likes, comments, shares } = entry.metrics
  if (impressions === 0) return 0
  return (likes + comments + shares) / impressions
}

/** Post com maior `score` — mesmo critério de ranqueamento já usado pela API. */
export function findBestPost(entries: ApiPostPerformanceEntry[]): ApiPostPerformanceEntry | null {
  if (entries.length === 0) return null
  return [...entries].sort((a, b) => b.score - a.score)[0]!
}

/** Chave de semana ISO ("2026-W28") a partir de uma data ISO. */
function isoWeekKey(dateStr: string): string {
  const date = new Date(dateStr)
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${weekNum}`
}

/**
 * Variação percentual da taxa média de engajamento da semana mais recente
 * contra a semana anterior. `null` se não houver dado em pelo menos duas
 * semanas distintas (não dá pra comparar) ou se a semana anterior teve
 * engajamento zero (divisão por zero sem sentido).
 */
export function weekOverWeekDelta(entries: ApiPostPerformanceEntry[]): number | null {
  if (entries.length === 0) return null
  const byWeek = new Map<string, number[]>()
  for (const entry of entries) {
    const key = isoWeekKey(entry.publishedAt)
    const rates = byWeek.get(key) ?? []
    rates.push(engagementRate(entry))
    byWeek.set(key, rates)
  }
  const weeks = [...byWeek.keys()].sort()
  if (weeks.length < 2) return null
  const avg = (arr: number[]) => arr.reduce((sum, v) => sum + v, 0) / arr.length
  const lastAvg = avg(byWeek.get(weeks[weeks.length - 1]!)!)
  const prevAvg = avg(byWeek.get(weeks[weeks.length - 2]!)!)
  if (prevAvg === 0) return null
  return ((lastAvg - prevAvg) / prevAvg) * 100
}

/** Mensagem completa do Selfie para a tela de Performance. */
export function buildPerformanceMessage(entries: ApiPostPerformanceEntry[]): string | null {
  const best = findBestPost(entries)
  if (!best) return null
  const rate = Math.round(engagementRate(best) * 100)
  const platformLabel = PLATFORM_META[best.platform]?.label ?? best.platform
  let message = `Seu post de melhor desempenho foi no ${platformLabel}, com ${rate}% de engajamento`

  const delta = weekOverWeekDelta(entries)
  if (delta === null) {
    message += '!'
  } else {
    const rounded = Math.round(delta)
    message +=
      rounded >= 0
        ? `. Essa semana o engajamento está ${rounded}% acima da semana passada!`
        : `. Essa semana o engajamento caiu ${Math.abs(rounded)}% frente à semana passada.`
  }
  return message
}
