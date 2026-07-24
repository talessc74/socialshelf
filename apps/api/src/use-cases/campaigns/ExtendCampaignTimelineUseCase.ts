import { randomUUID } from 'crypto'
import { DEFAULT_ACCOUNT_TYPE } from '@socialshelf/domain'
import type {
  BrandProfileRepository,
  BrandRepository,
  CampaignItem,
  CampaignItemRepository,
  CampaignPhoto,
  CampaignPhotoRepository,
  CampaignTimelineLockRepository,
  PhotoCampaign,
  PhotoCampaignRepository,
  PostRepository,
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
import { materializeCampaignItems } from './materializeCampaignItems.js'
import { mapWithConcurrency } from './mapWithConcurrency.js'
import type { CampaignCaptionClient } from '../../infrastructure/generator/CampaignCaptionClient.js'

export interface ExtendCampaignTimelineInput {
  userId: string
  brandId: string
  campaignId: string
}

/**
 * Agenda fotos enviadas DEPOIS que a linha do tempo já existia — uma campanha aceita fotos
 * novas a qualquer momento, na preparação (reviewing) ou já ativa publicando (active).
 * Diferente de GenerateCampaignTimelineUseCase, que apaga e recria tudo (seguro só enquanto
 * nada foi materializado), este use case só ANEXA itens novos a partir das fotos ainda não
 * referenciadas por nenhum CampaignItem — nunca toca nos itens existentes, mesmo já
 * materializados com um Post real publicado.
 *
 * Numa campanha 'active', os itens novos são materializados em Posts reais na hora, sem passo
 * de revisão extra — combinam com a cadência (postsPerDay) já em andamento, agendados a partir
 * do dia seguinte ao último item existente.
 *
 * Adquire CampaignTimelineLockRepository antes de ler os itens existentes — sem isso, duas
 * chamadas concorrentes (duplo clique, retry de rede) leem o mesmo estado "antes" da linha do
 * tempo, calculam o mesmo conjunto de fotos "ainda não agendadas" e cada uma agenda essas fotos
 * num CampaignItem novo e diferente — a mesma foto acaba em dois posts (achado real em produção).
 */
export class ExtendCampaignTimelineUseCase {
  constructor(
    private readonly campaignRepo: PhotoCampaignRepository,
    private readonly photoRepo: CampaignPhotoRepository,
    private readonly itemRepo: CampaignItemRepository,
    private readonly postRepo: PostRepository,
    private readonly brandProfileRepo: BrandProfileRepository,
    private readonly captionClient: CampaignCaptionClient,
    private readonly lockRepo: CampaignTimelineLockRepository,
    private readonly brandRepo: BrandRepository,
  ) {}

  async execute(input: ExtendCampaignTimelineInput): Promise<CampaignItem[]> {
    const campaign = await this.campaignRepo.findByIdAndBrand(input.campaignId, input.userId, input.brandId)
    if (!campaign) throw new Error('Campaign not found')
    if (campaign.status !== 'reviewing' && campaign.status !== 'active') {
      throw new Error('Only a reviewing or active campaign can have new photos scheduled')
    }

    const acquired = await this.lockRepo.tryAcquire(input.userId, input.brandId, input.campaignId)
    if (!acquired) {
      throw new Error('Another timeline update for this campaign is already in progress — try again shortly')
    }

    try {
      const [photos, existingItems] = await Promise.all([
        this.photoRepo.findByCampaign(input.campaignId),
        this.itemRepo.findByCampaign(input.campaignId),
      ])

      const scheduledPhotoIds = new Set(existingItems.flatMap((item) => item.photoIds))
      const newPhotos = photos.filter((photo) => !scheduledPhotoIds.has(photo.id))
      if (newPhotos.length === 0) throw new Error('No new photos to schedule')

      // Mesmo tratamento de GenerateCampaignTimelineUseCase: fotos incompatíveis com o Instagram
      // nunca entram num carrossel quando a campanha inclui Instagram.
      const { supported, unsupported } = splitByAspectRatioSupport(newPhotos, campaign.platforms)
      if (supported.length === 0) {
        throw new Error('All new photos have an aspect ratio unsupported by Instagram — remove Instagram from the campaign or add compatible photos')
      }
      const photosById = new Map(supported.map((p) => [p.id, p]))

      const clusters = clusterByLocation(supported)
      const carouselSize = Math.min(campaign.carouselSizeDefault, maxCarouselSizeForPlatforms(campaign.platforms))
      // Colapsa quase-iguais só entre as fotos novas (as já agendadas não são tocadas).
      const collapsedExtras: Array<{ photo: (typeof newPhotos)[number]; representativeId: string }> = []
      const groupsByCluster = [...clusters.values()].map((clusterPhotos) => {
        const { kept, extras } = collapseNearDuplicates(clusterPhotos)
        collapsedExtras.push(...extras)
        return groupIntoCarousels(kept, carouselSize)
      })
      const orderedGroups = interleaveGroups(groupsByCluster)

      // Continua a partir do dia seguinte ao último item já agendado — não tenta preencher os
      // slots restantes de um dia parcialmente ocupado, só evita colidir com o que já existe.
      const lastScheduledAt = existingItems.reduce<Date | null>(
        (latest, item) => (!latest || item.scheduledAt > latest ? item.scheduledAt : latest),
        null,
      )
      const startDate = lastScheduledAt ? addDays(lastScheduledAt, 1) : new Date()
      const scheduledTimes = computeScheduledTimes(orderedGroups.length, campaign.postsPerDay, startDate)

      const nextOrder = existingItems.reduce((max, item) => Math.max(max, item.order), -1) + 1

      const brand = await this.brandRepo.findById(input.userId, input.brandId)
      const accountType = brand?.accountType ?? DEFAULT_ACCOUNT_TYPE

      // Concorrência limitada (CAPTION_CONCURRENCY) — mesma proteção de GenerateCampaignTimelineUseCase
      // contra sobrecarregar o generator-service com uma rajada de chamadas simultâneas.
      const captions = await mapWithConcurrency(orderedGroups, CAPTION_CONCURRENCY, (photoIds) =>
        captionForGroup(this.captionClient, campaign, photosById, photoIds, accountType),
      )

      const plannedItems: CampaignItem[] = orderedGroups.map((photoIds, index) => ({
        id: randomUUID(),
        userId: campaign.userId,
        brandId: campaign.brandId,
        campaignId: campaign.id,
        order: nextOrder + index,
        photoIds,
        caption: captions[index]!,
        scheduledAt: scheduledTimes[index]!,
        status: 'planned',
        postId: null,
      }))

      const newItems =
        campaign.status === 'active'
          ? await this.materializeNewItems(campaign, plannedItems, photosById)
          : plannedItems

      await this.itemRepo.saveAll(newItems)
      await applyDuplicateMarks(this.photoRepo, newPhotos, collapsedExtras)
      await applyAspectRatioMarks(this.photoRepo, newPhotos, unsupported)
      campaign.updatedAt = new Date()
      await this.campaignRepo.save(campaign)

      return newItems
    } finally {
      await this.lockRepo.release(input.userId, input.brandId, input.campaignId)
    }
  }

  private async materializeNewItems(
    campaign: PhotoCampaign,
    items: CampaignItem[],
    photosById: Map<string, CampaignPhoto>,
  ): Promise<CampaignItem[]> {
    const brandProfile = await this.brandProfileRepo.findLatestByBrand(campaign.userId, campaign.brandId)
    return materializeCampaignItems(campaign, items, photosById, this.postRepo, brandProfile?.version ?? null)
  }
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}
