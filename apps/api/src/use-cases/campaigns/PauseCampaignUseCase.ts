import type {
  CampaignItemRepository,
  CampaignTimelineLockRepository,
  PhotoCampaignRepository,
  PostRepository,
} from '@socialshelf/domain'
import { cancelPendingCampaignPosts } from './cancelPendingCampaignPosts.js'

export interface PauseCampaignInput {
  userId: string
  brandId: string
  campaignId: string
}

export class PauseCampaignUseCase {
  constructor(
    private readonly campaignRepo: PhotoCampaignRepository,
    private readonly itemRepo: CampaignItemRepository,
    private readonly postRepo: PostRepository,
    private readonly lockRepo: CampaignTimelineLockRepository,
  ) {}

  async execute(input: PauseCampaignInput): Promise<void> {
    const campaign = await this.campaignRepo.findByIdAndBrand(input.campaignId, input.userId, input.brandId)
    if (!campaign) throw new Error('Campaign not found')
    if (campaign.status !== 'active') throw new Error('Only an active campaign can be paused')

    // Mesmo lock de Activate/Extend/Resume — evita pausar no meio de uma materialização
    // concorrente (ex: ExtendCampaignTimelineUseCase criando Posts novos ao mesmo tempo).
    const acquired = await this.lockRepo.tryAcquire(input.userId, input.brandId, input.campaignId)
    if (!acquired) {
      throw new Error('Another timeline update for this campaign is already in progress — try again shortly')
    }

    try {
      const items = await this.itemRepo.findByCampaign(input.campaignId)
      await cancelPendingCampaignPosts(items, this.itemRepo, this.postRepo)

      campaign.status = 'paused'
      campaign.updatedAt = new Date()
      await this.campaignRepo.save(campaign)
    } finally {
      await this.lockRepo.release(input.userId, input.brandId, input.campaignId)
    }
  }
}
