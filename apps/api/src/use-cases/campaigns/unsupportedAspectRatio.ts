import { Platform } from '@socialshelf/domain'
import type { CampaignPhoto } from '@socialshelf/domain'

// Intervalo de proporção largura/altura que a Graph API do Instagram aceita pra publicar uma
// foto (feed/carrossel): 4:5 (retrato) até 1.91:1 (paisagem). Fora disso, o próprio Instagram
// rejeita o container com "The aspect ratio is not supported" — achado real em produção com uma
// foto panorâmica de iPhone.
export const INSTAGRAM_MIN_ASPECT_RATIO = 4 / 5
export const INSTAGRAM_MAX_ASPECT_RATIO = 1.91

// Null (sharp não conseguiu ler as dimensões) nunca é tratado como incompatível — mesma filosofia
// do perceptualHash null em nearDuplicates.ts: sem o dado real, não arrisca um falso positivo.
export function isUnsupportedForInstagram(aspectRatio: number | null): boolean {
  if (aspectRatio === null) return false
  return aspectRatio < INSTAGRAM_MIN_ASPECT_RATIO || aspectRatio > INSTAGRAM_MAX_ASPECT_RATIO
}

export interface AspectRatioSplitResult {
  supported: CampaignPhoto[]
  unsupported: CampaignPhoto[]
}

/**
 * Separa as fotos compatíveis das incompatíveis com o Instagram. Se a campanha não inclui
 * Instagram entre as plataformas, nenhuma foto é excluída — a restrição de proporção é
 * específica da Graph API do Instagram, Facebook/LinkedIn aceitam qualquer proporção razoável.
 */
export function splitByAspectRatioSupport(photos: CampaignPhoto[], platforms: Platform[]): AspectRatioSplitResult {
  if (!platforms.includes(Platform.INSTAGRAM)) return { supported: photos, unsupported: [] }

  const supported: CampaignPhoto[] = []
  const unsupported: CampaignPhoto[] = []
  for (const photo of photos) {
    if (isUnsupportedForInstagram(photo.aspectRatio)) unsupported.push(photo)
    else supported.push(photo)
  }
  return { supported, unsupported }
}
