import type { ApiBrandProfile } from './api'

/**
 * Mensagem do Selfie para a tela de Novo Post (composição manual): lembrete
 * do tom de voz configurado da marca. Único ponto do mapeamento sem dado
 * dinâmico — é um lembrete de configuração, não uma métrica.
 */
export function buildComposeReminder(brandProfile: ApiBrandProfile | null): string | null {
  if (!brandProfile) return null
  const tone = brandProfile.voice.tone.trim()
  if (!tone) return null
  const brandName = brandProfile.business.name.trim() || 'sua marca'
  return `Lembrete: a voz da ${brandName} é "${tone}".`
}
