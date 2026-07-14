import type { ApiPost } from './api'

/** Mesma chave de dia (local, "YYYY-M-D") já usada pelo CalendarView da tela de Agenda. */
function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

/**
 * Mensagem do Selfie para a tela de Agenda: resumo de quantos posts já
 * foram publicados hoje e quantos estão agendados para os próximos dias.
 */
export function buildScheduleSummary(scheduledPosts: ApiPost[], publishedPosts: ApiPost[]): string | null {
  if (scheduledPosts.length === 0 && publishedPosts.length === 0) return null

  const today = new Date()
  const todayKey = dayKey(today)

  const publishedToday = publishedPosts.filter(
    (p) => p.publishedAt && dayKey(new Date(p.publishedAt)) === todayKey,
  ).length

  const upcoming = scheduledPosts.filter((p) => p.scheduledAt && new Date(p.scheduledAt) > today).length

  if (publishedToday === 0 && upcoming === 0) return null

  const parts: string[] = []
  if (publishedToday > 0) parts.push(`hoje você já publicou ${publishedToday} post${publishedToday > 1 ? 's' : ''}`)
  if (upcoming > 0) parts.push(`tem ${upcoming} agendado${upcoming > 1 ? 's' : ''} pra frente`)

  const joined = parts.join(' e ')
  return `${joined.charAt(0).toUpperCase()}${joined.slice(1)}!`
}
