import type { ApiBrandProfile } from './api'

// Campos-chave usados para orientar a geração de conteúdo (BDR-006: "sem
// perfil de marca rico, toda geração é genérica"). Presença simples, não
// qualidade do conteúdo — é um empurrão pra completar o perfil, não uma nota.
const FIELD_CHECKS: Array<(p: ApiBrandProfile) => boolean> = [
  (p) => p.business.name.trim().length > 0,
  (p) => p.business.segment.trim().length > 0,
  (p) => p.identity.positioning.trim().length > 0,
  (p) => p.voice.tone.trim().length > 0,
  (p) => p.visual.logoStoragePath !== null,
  (p) => p.narrative.recurringThemes.length > 0,
]

/**
 * Mensagem do Selfie para a tela de Marca. `null` se ainda não existe
 * BrandProfile (a própria tela já tem um banner dedicado pra esse caso).
 */
export function buildBrandMessage(brandProfile: ApiBrandProfile | null): string | null {
  if (!brandProfile) return null

  const filled = FIELD_CHECKS.filter((check) => check(brandProfile)).length
  const total = FIELD_CHECKS.length

  if (filled === total) {
    return 'Sua marca está com o perfil completo — a IA tem tudo que precisa pra escrever com a sua voz!'
  }
  return `Sua marca está em ${filled}/${total} campos-chave preenchidos. Quanto mais completo, melhor a IA escreve.`
}
