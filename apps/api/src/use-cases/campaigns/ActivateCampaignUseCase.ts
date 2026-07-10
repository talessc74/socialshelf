import { randomUUID } from 'crypto'
import { PLATFORM_CHARACTER_LIMITS } from '@socialshelf/domain'
import type {
  BrandProfileRepository,
  CampaignItem,
  CampaignItemRepository,
  CampaignPhotoRepository,
  PhotoCampaignRepository,
  PlatformContent,
  Post,
  PostRepository,
} from '@socialshelf/domain'

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
  ) {}

  async execute(input: ActivateCampaignInput): Promise<void> {
    const campaign = await this.campaignRepo.findByIdAndBrand(input.campaignId, input.userId, input.brandId)
    if (!campaign) throw new Error('Campaign not found')
    if (campaign.status !== 'reviewing') throw new Error('Only a campaign in review can be activated')

    const items = await this.itemRepo.findByCampaign(input.campaignId)
    if (items.length === 0) throw new Error('Campaign has no timeline to activate')

    const photos = await this.photoRepo.findByCampaign(input.campaignId)
    const photosById = new Map(photos.map((p) => [p.id, p]))
    const brandProfile = await this.brandProfileRepo.findLatestByBrand(input.userId, input.brandId)

    const materialized: CampaignItem[] = []
    for (const item of items) {
      if (item.status === 'materialized') {
        materialized.push(item)
        continue
      }

      const imageStoragePaths = item.photoIds.map((photoId) => {
        const photo = photosById.get(photoId)
        if (!photo) throw new Error(`Photo ${photoId} referenced by campaign item ${item.id} not found`)
        return photo.storagePath
      })

      const content: PlatformContent[] = campaign.platforms.map((platform) => {
        const limit = PLATFORM_CHARACTER_LIMITS[platform]
        const text = item.caption.length > limit ? item.caption.slice(0, limit) : item.caption
        return { platform, text, charCount: text.length }
      })

      const post: Post = {
        id: randomUUID(),
        userId: input.userId,
        brandId: input.brandId,
        brandProfileVersion: brandProfile?.version ?? null,
        content,
        imageStoragePaths,
        videoStoragePath: null,
        videoConsentAcceptedAt: null,
        status: 'scheduled',
        origin: 'campaign',
        campaignId: campaign.id,
        scheduledAt: item.scheduledAt,
        publishedAt: null,
        externalIds: {},
        sourceArticleUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      await this.postRepo.save(post)
      materialized.push({ ...item, status: 'materialized', postId: post.id })
    }

    await this.itemRepo.saveAll(materialized)

    campaign.status = 'active'
    campaign.startedAt = campaign.startedAt ?? new Date()
    campaign.updatedAt = new Date()
    await this.campaignRepo.save(campaign)
  }
}
