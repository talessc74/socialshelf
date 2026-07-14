import type { PhotoCampaignRepository } from '@socialshelf/domain'

export interface CancelCampaignInput {
  userId: string
  brandId: string
  campaignId: string
}

export class CancelCampaignUseCase {
  constructor(private readonly campaignRepo: PhotoCampaignRepository) {}

  async execute(input: CancelCampaignInput): Promise<void> {
    const campaign = await this.campaignRepo.findByIdAndBrand(input.campaignId, input.userId, input.brandId)
    if (!campaign) throw new Error('Campaign not found')
    if (campaign.status !== 'draft' && campaign.status !== 'reviewing') {
      throw new Error('Only a campaign that has not started can be cancelled')
    }

    campaign.status = 'cancelled'
    campaign.updatedAt = new Date()
    await this.campaignRepo.save(campaign)
  }
}
