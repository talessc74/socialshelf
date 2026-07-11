import type { CampaignPhotoRepository, PhotoCampaignRepository } from '@socialshelf/domain'
import { fetchInternal } from '../../lib/serviceAuth.js'

export interface DeleteCampaignPhotoInput {
  userId: string
  brandId: string
  campaignId: string
  photoId: string
}

export class DeleteCampaignPhotoUseCase {
  constructor(
    private readonly campaignRepo: PhotoCampaignRepository,
    private readonly photoRepo: CampaignPhotoRepository,
    private readonly generatorUrl: string,
    private readonly internalSecret: string,
  ) {}

  async execute(input: DeleteCampaignPhotoInput): Promise<void> {
    const campaign = await this.campaignRepo.findByIdAndBrand(input.campaignId, input.userId, input.brandId)
    if (!campaign) throw new Error('Campaign not found')

    const photo = await this.photoRepo.delete(input.userId, input.brandId, input.campaignId, input.photoId)
    if (!photo) throw new Error('Photo not found')

    // Best-effort: the Firestore doc (what every screen actually reads) is already gone,
    // so a failure to reclaim the underlying blob shouldn't fail the user-visible deletion.
    try {
      await fetchInternal(`${this.generatorUrl}/images/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Internal-Secret': this.internalSecret },
        body: JSON.stringify({ path: photo.storagePath }),
      })
    } catch {
      // ignore — orphaned blob, not an orphaned reference
    }
  }
}
