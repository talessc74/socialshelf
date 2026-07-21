import type { CampaignItemRepository, PhotoCampaignRepository, PostRepository } from '@socialshelf/domain'
import { cancelPendingCampaignPosts } from './cancelPendingCampaignPosts.js'

export interface CancelCampaignInput {
  userId: string
  brandId: string
  campaignId: string
}

export class CancelCampaignUseCase {
  constructor(
    private readonly campaignRepo: PhotoCampaignRepository,
    private readonly itemRepo: CampaignItemRepository,
    private readonly postRepo: PostRepository,
  ) {}

  async execute(input: CancelCampaignInput): Promise<void> {
    const campaign = await this.campaignRepo.findByIdAndBrand(input.campaignId, input.userId, input.brandId)
    if (!campaign) throw new Error('Campaign not found')
    if (campaign.status === 'completed' || campaign.status === 'cancelled') {
      throw new Error('A campaign that already finished cannot be cancelled')
    }

    // draft/reviewing nunca materializaram nada — não há Post real pra desfazer. active/paused
    // podem ter Posts 'scheduled' esperando o próximo tick do publisher; cancelar precisa
    // apagá-los, senão a campanha vira 'cancelled' mas os posts continuam sendo publicados.
    if (campaign.status === 'active' || campaign.status === 'paused') {
      const items = await this.itemRepo.findByCampaign(input.campaignId)
      await cancelPendingCampaignPosts(items, this.itemRepo, this.postRepo)
    }

    campaign.status = 'cancelled'
    campaign.updatedAt = new Date()
    await this.campaignRepo.save(campaign)
  }
}
