import { Platform, isAspectRatioUnsupportedForInstagram, INSTAGRAM_MIN_ASPECT_RATIO, INSTAGRAM_MAX_ASPECT_RATIO } from '@socialshelf/domain'
import type { CampaignPhoto } from '@socialshelf/domain'

// Constantes e predicado vivem em packages/domain (compartilhadas com apps/web, que avisa qual
// foto específica é incompatível ao editar um post — ver _local-edr-policy-066). Reexportadas
// aqui pra não precisar atualizar os imports já existentes neste módulo.
export { INSTAGRAM_MIN_ASPECT_RATIO, INSTAGRAM_MAX_ASPECT_RATIO }
export const isUnsupportedForInstagram = isAspectRatioUnsupportedForInstagram

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
