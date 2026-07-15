import type { CampaignPhoto, PhotoCampaign } from '@socialshelf/domain'
import type { CampaignCaptionClient } from '../../infrastructure/generator/CampaignCaptionClient.js'

// Compartilhado entre GenerateCampaignTimelineUseCase e ExtendCampaignTimelineUseCase — os dois
// precisam da mesma legenda por IA (com fallback determinístico) pra cada grupo de fotos.
export async function captionForGroup(
  captionClient: CampaignCaptionClient,
  campaign: PhotoCampaign,
  photosById: Map<string, CampaignPhoto>,
  photoIds: string[],
): Promise<string> {
  const coverPhoto = photosById.get(photoIds[0]!)
  if (!coverPhoto) return defaultCaption(campaign)

  try {
    const { caption } = await captionClient.suggestCaption({
      userId: campaign.userId,
      brandId: campaign.brandId,
      storagePath: coverPhoto.storagePath,
      campaignName: campaign.name,
      campaignDescription: campaign.description,
      keywords: campaign.keywords,
    })
    return caption
  } catch {
    return defaultCaption(campaign)
  }
}

// Legenda de reserva quando a IA não consegue escrever uma (generator-service indisponível,
// sem foto de capa localizável) — o usuário sempre pode editar cada item na tela de revisão
// antes de ativar (_local-edr-policy-039).
export function defaultCaption(campaign: PhotoCampaign): string {
  const base = campaign.description.trim().length > 0 ? campaign.description.trim() : campaign.name
  if (campaign.keywords.length === 0) return base
  const hashtags = campaign.keywords.map((k) => `#${k.trim().replace(/\s+/g, '')}`).join(' ')
  return `${base}\n\n${hashtags}`
}
