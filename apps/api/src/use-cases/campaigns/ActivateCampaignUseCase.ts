import type {
  BrandProfileRepository,
  CampaignItemRepository,
  CampaignPhotoRepository,
  CampaignTimelineLockRepository,
  PhotoCampaignRepository,
  PostRepository,
} from '@socialshelf/domain'
import { materializeCampaignItems } from './materializeCampaignItems.js'

export interface ActivateCampaignInput {
  userId: string
  brandId: string
  campaignId: string
}

export class ActivateCampaignUseCase {
  constructor(
    private readonly campaignRepo: PhotoCampaignRepository,
    private readonly itemRepo: CampaignItemRepository,
    private readonly photoRepo: CampaignPhotoRepository,
    private readonly postRepo: PostRepository,
    private readonly brandProfileRepo: BrandProfileRepository,
    private readonly lockRepo: CampaignTimelineLockRepository,
  ) {}

  async execute(input: ActivateCampaignInput): Promise<void> {
    const campaign = await this.campaignRepo.findByIdAndBrand(input.campaignId, input.userId, input.brandId)
    if (!campaign) throw new Error('Campaign not found')
    if (campaign.status !== 'reviewing') throw new Error('Only a campaign in review can be activated')

    // Mesmo lock de Generate/ExtendCampaignTimelineUseCase — um duplo clique em "Ativar
    // campanha" sem isso materializaria os mesmos itens duas vezes, criando dois Posts reais
    // para a mesma foto.
    const acquired = await this.lockRepo.tryAcquire(input.userId, input.brandId, input.campaignId)
    if (!acquired) {
      throw new Error('Another timeline update for this campaign is already in progress — try again shortly')
    }

    try {
      const items = await this.itemRepo.findByCampaign(input.campaignId)
      if (items.length === 0) throw new Error('Campaign has no timeline to activate')

      const photos = await this.photoRepo.findByCampaign(input.campaignId)
      const photosById = new Map(photos.map((p) => [p.id, p]))
      const brandProfile = await this.brandProfileRepo.findLatestByBrand(input.userId, input.brandId)

      const alreadyMaterialized = items.filter((item) => item.status === 'materialized')
      const toMaterialize = items.filter((item) => item.status !== 'materialized')
      const newlyMaterialized = await materializeCampaignItems(
        campaign,
        toMaterialize,
        photosById,
        this.postRepo,
        brandProfile?.version ?? null,
      )

      await this.itemRepo.saveAll([...alreadyMaterialized, ...newlyMaterialized])

      campaign.status = 'active'
      campaign.startedAt = campaign.startedAt ?? new Date()
      campaign.updatedAt = new Date()
      await this.campaignRepo.save(campaign)
    } finally {
      await this.lockRepo.release(input.userId, input.brandId, input.campaignId)
    }
  }
}
