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
import { captionForGroup, CAPTION_CONCURRENCY } from './campaignCaption.js'
import { collapseNearDuplicates } from './nearDuplicates.js'
import { applyDuplicateMarks } from './duplicateMarks.js'
import { splitByAspectRatioSupport } from './unsupportedAspectRatio.js'
import { applyAspectRatioMarks } from './aspectRatioMarks.js'
import { mapWithConcurrency } from './mapWithConcurrency.js'
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

      // Fotos com proporção incompatível com o Instagram (achado real em produção: "The aspect
      // ratio is not supported") nunca entram num carrossel quando a campanha inclui Instagram —
      // ficam de fora e aparecem no pool de revisão, mesmo tratamento do near-duplicate.
      const { supported, unsupported } = splitByAspectRatioSupport(photos, campaign.platforms)
      if (supported.length === 0) {
        throw new Error('All photos have an aspect ratio unsupported by Instagram — remove Instagram from the campaign or add compatible photos')
      }
      const photosById = new Map(supported.map((p) => [p.id, p]))

      const clusters = clusterByLocation(supported)
      const carouselSize = Math.min(campaign.carouselSizeDefault, maxCarouselSizeForPlatforms(campaign.platforms))
      // Dentro de cada cluster (mesmo local/momento) colapsa as fotos quase-iguais: só os
      // representantes entram nos carrosséis; os extras são marcados e aparecem no pool de revisão.
      const collapsedExtras: Array<{ photo: (typeof photos)[number]; representativeId: string }> = []
      const groupsByCluster = [...clusters.values()].map((clusterPhotos) => {
        const { kept, extras } = collapseNearDuplicates(clusterPhotos)
        collapsedExtras.push(...extras)
        return groupIntoCarousels(kept, carouselSize)
      })
      const orderedGroups = interleaveGroups(groupsByCluster)

      const scheduledTimes = computeScheduledTimes(orderedGroups.length, campaign.postsPerDay, input.startDate ?? new Date())

      const brand = await this.brandRepo.findById(input.userId, input.brandId)
      const accountType = brand?.accountType ?? DEFAULT_ACCOUNT_TYPE

      // Uma legenda por item, olhando a foto de capa daquele item (Gemini vision) — em paralelo,
      // não sequencial, porque uma campanha pode ter dezenas de itens e isso rodaria dentro de
      // uma única requisição HTTP. A concorrência é limitada (CAPTION_CONCURRENCY): disparar
      // TODAS de uma vez sobrecarregava o generator-service (Cloud Run com max-instances=2),
      // derrubando a legenda pra template em quase todo item — achado real em produção. Item
      // cujo pedido falha mesmo assim cai pro template determinístico antigo — nunca trava a
      // campanha inteira por causa de 1 item (mesmo espírito de isolamento de falha por marca
      // do tick de autonomia).
      const captions = await mapWithConcurrency(orderedGroups, CAPTION_CONCURRENCY, (photoIds) =>
        captionForGroup(this.captionClient, campaign, photosById, photoIds, accountType),
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
      // Regeneração é do zero: reseta todas as fotos e remarca só os extras deste passo.
      await applyDuplicateMarks(this.photoRepo, photos, collapsedExtras)
      await applyAspectRatioMarks(this.photoRepo, photos, unsupported)

      campaign.status = 'reviewing'
      campaign.updatedAt = new Date()
      await this.campaignRepo.save(campaign)

      return items
    } finally {
      await this.lockRepo.release(input.userId, input.brandId, input.campaignId)
    }
  }
}
