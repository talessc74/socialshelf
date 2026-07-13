import { randomUUID } from 'crypto'
import type {
  CampaignItem,
  CampaignPhoto,
  CampaignItemRepository,
  CampaignPhotoRepository,
  PhotoCampaign,
  PhotoCampaignRepository,
} from '@socialshelf/domain'
import {
  clusterByLocation,
  computeScheduledTimes,
  groupIntoCarousels,
  interleaveGroups,
  maxCarouselSizeForPlatforms,
} from './locationClustering.js'
import type { CampaignCaptionClient } from '../../infrastructure/generator/CampaignCaptionClient.js'

export interface GenerateCampaignTimelineInput {
  userId: string
  brandId: string
  campaignId: string
  startDate?: Date
}

export class GenerateCampaignTimelineUseCase {
  constructor(
    private readonly campaignRepo: PhotoCampaignRepository,
    private readonly photoRepo: CampaignPhotoRepository,
    private readonly itemRepo: CampaignItemRepository,
    private readonly captionClient: CampaignCaptionClient,
  ) {}

  async execute(input: GenerateCampaignTimelineInput): Promise<CampaignItem[]> {
    const campaign = await this.campaignRepo.findByIdAndBrand(input.campaignId, input.userId, input.brandId)
    if (!campaign) throw new Error('Campaign not found')

    const photos = await this.photoRepo.findByCampaign(input.campaignId)
    if (photos.length === 0) throw new Error('Campaign has no photos to schedule')
    const photosById = new Map(photos.map((p) => [p.id, p]))

    const clusters = clusterByLocation(photos)
    const carouselSize = Math.min(campaign.carouselSizeDefault, maxCarouselSizeForPlatforms(campaign.platforms))
    const groupsByCluster = [...clusters.values()].map((clusterPhotos) => groupIntoCarousels(clusterPhotos, carouselSize))
    const orderedGroups = interleaveGroups(groupsByCluster)

    const scheduledTimes = computeScheduledTimes(orderedGroups.length, campaign.postsPerDay, input.startDate ?? new Date())

    // Uma legenda por item, olhando a foto de capa daquele item (Gemini vision) — em paralelo,
    // não sequencial, porque uma campanha pode ter dezenas de itens e isso rodaria dentro de
    // uma única requisição HTTP. Item cujo pedido falha (generator-service fora do ar, foto
    // corrompida, etc.) cai pro template determinístico antigo — nunca trava a campanha
    // inteira por causa de 1 item (mesmo espírito de isolamento de falha por marca do tick
    // de autonomia).
    const captions = await Promise.all(
      orderedGroups.map((photoIds) => this.captionFor(campaign, photosById, photoIds)),
    )

    const items: CampaignItem[] = orderedGroups.map((photoIds, index) => ({
      id: randomUUID(),
      userId: campaign.userId,
      brandId: campaign.brandId,
      campaignId: campaign.id,
      order: index,
      photoIds,
      caption: captions[index]!,
      scheduledAt: scheduledTimes[index]!,
      status: 'planned',
      postId: null,
    }))

    await this.itemRepo.deleteByCampaign(campaign.id)
    await this.itemRepo.saveAll(items)

    campaign.status = 'reviewing'
    campaign.updatedAt = new Date()
    await this.campaignRepo.save(campaign)

    return items
  }

  private async captionFor(
    campaign: PhotoCampaign,
    photosById: Map<string, CampaignPhoto>,
    photoIds: string[],
  ): Promise<string> {
    const coverPhoto = photosById.get(photoIds[0]!)
    if (!coverPhoto) return defaultCaption(campaign)

    try {
      const { caption } = await this.captionClient.suggestCaption({
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
}

// Legenda de reserva quando a IA não consegue escrever uma (generator-service indisponível,
// sem foto de capa localizável) — o usuário sempre pode editar cada item na tela de revisão
// antes de ativar (_local-edr-policy-039).
function defaultCaption(campaign: PhotoCampaign): string {
  const base = campaign.description.trim().length > 0 ? campaign.description.trim() : campaign.name
  if (campaign.keywords.length === 0) return base
  const hashtags = campaign.keywords.map((k) => `#${k.trim().replace(/\s+/g, '')}`).join(' ')
  return `${base}\n\n${hashtags}`
}
