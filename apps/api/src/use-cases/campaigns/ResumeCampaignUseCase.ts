import type {
  BrandProfileRepository,
  CampaignItemRepository,
  CampaignPhotoRepository,
  CampaignTimelineLockRepository,
  PhotoCampaignRepository,
  PostRepository,
} from '@socialshelf/domain'
import { computeScheduledTimes } from './locationClustering.js'
import { materializeCampaignItems } from './materializeCampaignItems.js'

export interface ResumeCampaignInput {
  userId: string
  brandId: string
  campaignId: string
}

export class ResumeCampaignUseCase {
  constructor(
    private readonly campaignRepo: PhotoCampaignRepository,
    private readonly itemRepo: CampaignItemRepository,
    private readonly photoRepo: CampaignPhotoRepository,
    private readonly postRepo: PostRepository,
    private readonly brandProfileRepo: BrandProfileRepository,
    private readonly lockRepo: CampaignTimelineLockRepository,
  ) {}

  async execute(input: ResumeCampaignInput): Promise<void> {
    const campaign = await this.campaignRepo.findByIdAndBrand(input.campaignId, input.userId, input.brandId)
    if (!campaign) throw new Error('Campaign not found')
    if (campaign.status !== 'paused') throw new Error('Only a paused campaign can be resumed')

    const acquired = await this.lockRepo.tryAcquire(input.userId, input.brandId, input.campaignId)
    if (!acquired) {
      throw new Error('Another timeline update for this campaign is already in progress — try again shortly')
    }

    try {
      const items = await this.itemRepo.findByCampaign(input.campaignId)
      // 'planned' aqui é só o que o Pause devolveu (Post apagado, ver cancelPendingCampaignPosts)
      // — o que já publicou antes de pausar continua 'materialized' e não é tocado.
      const pending = [...items.filter((item) => item.status === 'planned')].sort((a, b) => a.order - b.order)

      if (pending.length > 0) {
        // Reagenda a partir de agora, não de onde a linha do tempo tinha parado — o tempo que a
        // campanha ficou pausada não deve virar um acúmulo de posts atrasados.
        const scheduledTimes = computeScheduledTimes(pending.length, campaign.postsPerDay, new Date())
        const rescheduled = pending.map((item, index) => ({ ...item, scheduledAt: scheduledTimes[index]! }))

        const [photos, brandProfile] = await Promise.all([
          this.photoRepo.findByCampaign(input.campaignId),
          this.brandProfileRepo.findLatestByBrand(input.userId, input.brandId),
        ])
        const photosById = new Map(photos.map((p) => [p.id, p]))

        const materialized = await materializeCampaignItems(
          campaign,
          rescheduled,
          photosById,
          this.postRepo,
          brandProfile?.version ?? null,
        )
        await this.itemRepo.saveAll(materialized)
      }

      campaign.status = 'active'
      campaign.updatedAt = new Date()
      await this.campaignRepo.save(campaign)
    } finally {
      await this.lockRepo.release(input.userId, input.brandId, input.campaignId)
    }
  }
}
