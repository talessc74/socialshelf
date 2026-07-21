import { randomUUID } from 'crypto'
import { DEFAULT_ACCOUNT_TYPE } from '@socialshelf/domain'
import type {
  BrandRepository,
  CampaignItem,
  CampaignItemRepository,
  CampaignPhotoRepository,
  CampaignTimelineLockRepository,
  PhotoCampaignRepository,
} from '@socialshelf/domain'
import {
  clusterByLocation,
  computeScheduledTimes,
  groupIntoCarousels,
  interleaveGroups,
  maxCarouselSizeForPlatforms,
} from './locationClustering.js'
import { captionForGroup } from './campaignCaption.js'
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
    private readonly lockRepo: CampaignTimelineLockRepository,
    private readonly brandRepo: BrandRepository,
  ) {}

  async execute(input: GenerateCampaignTimelineInput): Promise<CampaignItem[]> {
    const campaign = await this.campaignRepo.findByIdAndBrand(input.campaignId, input.userId, input.brandId)
    if (!campaign) throw new Error('Campaign not found')
    // Regenerar do zero (deleteByCampaign + saveAll) só é seguro enquanto nenhum item foi
    // materializado em Post real — o que vale pra 'draft' e 'reviewing'. Numa campanha 'active'
    // isso apagaria itens já publicados/agendados; use ExtendCampaignTimelineUseCase pra
    // anexar fotos novas sem tocar no que já existe.
    if (campaign.status !== 'draft' && campaign.status !== 'reviewing') {
      throw new Error('Only a draft or reviewing campaign can have its timeline regenerated')
    }

    // Mesmo lock de ExtendCampaignTimelineUseCase — as duas mexem na mesma coleção de items
    // da campanha e não podem rodar concorrentemente uma com a outra nem consigo mesma.
    const acquired = await this.lockRepo.tryAcquire(input.userId, input.brandId, input.campaignId)
    if (!acquired) {
      throw new Error('Another timeline update for this campaign is already in progress — try again shortly')
    }

    try {
      const photos = await this.photoRepo.findByCampaign(input.campaignId)
      if (photos.length === 0) throw new Error('Campaign has no photos to schedule')
      const photosById = new Map(photos.map((p) => [p.id, p]))

      const clusters = clusterByLocation(photos)
      const carouselSize = Math.min(campaign.carouselSizeDefault, maxCarouselSizeForPlatforms(campaign.platforms))
      const groupsByCluster = [...clusters.values()].map((clusterPhotos) => groupIntoCarousels(clusterPhotos, carouselSize))
      const orderedGroups = interleaveGroups(groupsByCluster)

      const scheduledTimes = computeScheduledTimes(orderedGroups.length, campaign.postsPerDay, input.startDate ?? new Date())

      const brand = await this.brandRepo.findById(input.userId, input.brandId)
      const accountType = brand?.accountType ?? DEFAULT_ACCOUNT_TYPE

      // Uma legenda por item, olhando a foto de capa daquele item (Gemini vision) — em paralelo,
      // não sequencial, porque uma campanha pode ter dezenas de itens e isso rodaria dentro de
      // uma única requisição HTTP. Item cujo pedido falha (generator-service fora do ar, foto
      // corrompida, etc.) cai pro template determinístico antigo — nunca trava a campanha
      // inteira por causa de 1 item (mesmo espírito de isolamento de falha por marca do tick
      // de autonomia).
      const captions = await Promise.all(
        orderedGroups.map((photoIds) => captionForGroup(this.captionClient, campaign, photosById, photoIds, accountType)),
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
    } finally {
      await this.lockRepo.release(input.userId, input.brandId, input.campaignId)
    }
  }
}
