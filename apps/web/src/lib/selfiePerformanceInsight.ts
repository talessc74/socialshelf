import { Platform } from '@socialshelf/domain'
import type { ApiPostPerformanceEntry } from './api'
import { PLATFORM_META } from './platformMeta'

// Única fonte de verdade pra "este erro significa reconectar a conta" — usado tanto pelo aviso
// na tela de Performance quanto pela narração do Selfie, pra não ter duas lógicas de
// classificação divergindo. `RECONNECT_REQUIRED_MESSAGE` é a frase estável que os
// AnalyticsReaders (apps/publisher) agora sempre incluem quando o erro é de token/permissão —
// os outros termos ficam como compatibilidade com o formato cru antigo da Meta.
export function isPermissionError(message: string): boolean {
  return /OAuthException|pages_read_engagement|Page Public Content Access|perdeu a validade ou uma permiss[ãa]o necess[áa]ria/i.test(
    message,
  )
}

// A Meta só libera dados de Insights de Página (e dos posts dela) para Páginas com pelo menos
// 100 seguidores — abaixo disso ela retorna o mesmo erro genérico de permissão acima, mesmo com
// a permissão concedida e a conexão saudável (publicar continua funcionando). Reconectar a conta
// não resolve esse caso: é uma trava da própria Meta pelo tamanho da Página.
export function isFacebookFollowerThresholdError(platform: Platform, message: string): boolean {
  return platform === Platform.FACEBOOK && isPermissionError(message)
}

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

export interface PerformanceErrorEntry {
  platform: Platform
  message: string
}

/**
 * Mensagem completa do Selfie para a tela de Performance. Quando há um erro de conexão
 * acionável (token expirado/permissão perdida, exceto o caso de seguidores mínimos do
 * Facebook, que não é resolvido reconectando), o Selfie avisa disso em vez de comemorar o
 * melhor post — é a informação mais útil pro usuário no momento (_local-bdr-policy-011).
 */
export function buildPerformanceMessage(
  entries: ApiPostPerformanceEntry[],
  errors: PerformanceErrorEntry[] = [],
): string | null {
  const reconnectError = errors.find(
    (e) => isPermissionError(e.message) && !isFacebookFollowerThresholdError(e.platform, e.message),
  )
  if (reconnectError) {
    const label = PLATFORM_META[reconnectError.platform]?.label ?? reconnectError.platform
    return `Ei! A conexão com ${label} expirou ou perdeu uma permissão — vai em Contas e clica em Reconectar pra voltar a ver as métricas de lá.`
  }

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
