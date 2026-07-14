import type { ApiTopicSuggestion } from './api'

/**
 * Mensagem do Selfie na tela de Notícias: destaca a sugestão de maior
 * aderência à marca e narra o `rationale` dela — campo que a API já busca
 * mas que a interface nunca exibiu (ver EDR-049, tela de Notícias).
 */
export function pickTopNewsInsight(suggestions: ApiTopicSuggestion[]): string | null {
  if (suggestions.length === 0) return null
  const top = [...suggestions].sort((a, b) => b.audienceFitScore - a.audienceFitScore)[0]!
  if (!top.rationale) return null
  return `Olha essa: "${top.headline}" — ${top.rationale}`
}
