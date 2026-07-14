import type { ApiPerformanceSuggestion } from './api'

/**
 * Mensagem do Selfie para a tela de Insights: destaca a única ideia de
 * maior potencial viral entre as sugestões frescas e as guardadas. Cada
 * card já mostra esse dado individualmente — aqui é uma curadoria (a
 * melhor de todas), não repetição do que já aparece.
 */
export function pickTopSuggestion(
  fresh: ApiPerformanceSuggestion[],
  shelved: ApiPerformanceSuggestion[],
): string | null {
  const all = [...fresh, ...shelved]
  if (all.length === 0) return null

  const top = [...all].sort((a, b) => b.viralScore - a.viralScore)[0]!
  return `Sua ideia mais forte agora: "${top.headline}" (potencial viral ${Math.round(top.viralScore)}).`
}
