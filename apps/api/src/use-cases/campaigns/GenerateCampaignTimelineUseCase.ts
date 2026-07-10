import { randomUUID } from 'crypto'
import type {
  CampaignItem,
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
  ) {}

  async execute(input: GenerateCampaignTimelineInput): Promise<CampaignItem[]> {
    const campaign = await this.campaignRepo.findByIdAndBrand(input.campaignId, input.userId, input.brandId)
    if (!campaign) throw new Error('Campaign not found')

    const photos = await this.photoRepo.findByCampaign(input.campaignId)
    if (photos.length === 0) throw new Error('Campaign has no photos to schedule')

    const clusters = clusterByLocation(photos)
    const carouselSize = Math.min(campaign.carouselSizeDefault, maxCarouselSizeForPlatforms(campaign.platforms))
    const groupsByCluster = [...clusters.values()].map((clusterPhotos) => groupIntoCarousels(clusterPhotos, carouselSize))
    const orderedGroups = interleaveGroups(groupsByCluster)

    const scheduledTimes = computeScheduledTimes(orderedGroups.length, campaign.postsPerDay, input.startDate ?? new Date())
    const caption = defaultCaption(campaign)

    const items: CampaignItem[] = orderedGroups.map((photoIds, index) => ({
      id: randomUUID(),
      userId: campaign.userId,
      brandId: campaign.brandId,
      campaignId: campaign.id,
      order: index,
      photoIds,
      caption,
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
}

// Legenda inicial simples, sem chamar Gemini — o usuário edita cada item na tela de revisão
// antes de ativar (_local-edr-policy-039). Legenda automática via IA fica pra uma fase futura.
function defaultCaption(campaign: PhotoCampaign): string {
  const base = campaign.description.trim().length > 0 ? campaign.description.trim() : campaign.name
  if (campaign.keywords.length === 0) return base
  const hashtags = campaign.keywords.map((k) => `#${k.trim().replace(/\s+/g, '')}`).join(' ')
  return `${base}\n\n${hashtags}`
}
