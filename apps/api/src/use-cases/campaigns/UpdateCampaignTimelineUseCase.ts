import type { CampaignItem, CampaignItemRepository, PhotoCampaignRepository } from '@socialshelf/domain'

export interface UpdateCampaignTimelineInput {
  userId: string
  brandId: string
  campaignId: string
  items: Array<{
    id: string
    order: number
    photoIds: string[]
    caption: string
    scheduledAt: Date
  }>
}

export class UpdateCampaignTimelineUseCase {
  constructor(
    private readonly campaignRepo: PhotoCampaignRepository,
    private readonly itemRepo: CampaignItemRepository,
  ) {}

  async execute(input: UpdateCampaignTimelineInput): Promise<CampaignItem[]> {
    const campaign = await this.campaignRepo.findByIdAndBrand(input.campaignId, input.userId, input.brandId)
    if (!campaign) throw new Error('Campaign not found')
    if (campaign.status !== 'reviewing') {
      throw new Error('Only a campaign in review can have its timeline edited')
    }

    const existing = await this.itemRepo.findByCampaign(input.campaignId)
    const existingById = new Map(existing.map((item) => [item.id, item]))

    const items: CampaignItem[] = input.items.map((update) => {
      const current = existingById.get(update.id)
      if (!current) throw new Error(`Campaign item ${update.id} not found`)
      return {
        ...current,
        order: update.order,
        photoIds: update.photoIds,
        caption: update.caption,
        scheduledAt: update.scheduledAt,
      }
    })

    await this.itemRepo.saveAll(items)
    return items
  }
}
