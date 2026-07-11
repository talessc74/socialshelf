import type { CampaignPhotoRepository, PhotoCampaignRepository } from '@socialshelf/domain'

export interface ReorderCampaignPhotosInput {
  userId: string
  brandId: string
  campaignId: string
  photoIds: string[]
}

export class ReorderCampaignPhotosUseCase {
  constructor(
    private readonly campaignRepo: PhotoCampaignRepository,
    private readonly photoRepo: CampaignPhotoRepository,
  ) {}

  async execute(input: ReorderCampaignPhotosInput): Promise<void> {
    const campaign = await this.campaignRepo.findByIdAndBrand(input.campaignId, input.userId, input.brandId)
    if (!campaign) throw new Error('Campaign not found')
    if (campaign.status !== 'draft' && campaign.status !== 'reviewing') {
      throw new Error('Photos can only be reordered before the campaign is activated')
    }

    await this.photoRepo.reorder(input.userId, input.brandId, input.campaignId, input.photoIds)
  }
}
