import type { CampaignItemRepository, CampaignPhotoRepository, PhotoCampaignRepository } from '@socialshelf/domain'
import { CANCELLED_CAMPAIGN_PHOTO_RETENTION_DAYS } from '@socialshelf/domain'
import { fetchInternal } from '../../lib/serviceAuth.js'

export interface CleanupCancelledCampaignPhotosResult {
  campaignsCleaned: number
  blobsDeleted: number
  blobsFailed: number
}

// _local-edr-policy-067: apaga, N dias após uma campanha ser cancelada, as fotos que nunca
// viraram um Post real — CampaignItem ainda 'planned' no momento do cancelamento (ver
// cancelPendingCampaignPosts). Fotos de itens que ficaram 'materialized' NUNCA são tocadas
// aqui: o Post real que as referencia (mesmo storagePath, ver materializeCampaignItems) segue
// o próprio prazo em CleanupPublishedPostImagesUseCase — apagar o blob aqui apagaria a imagem
// de um post publicado ou aguardando publicação por baixo dos panos.
export class CleanupCancelledCampaignPhotosUseCase {
  constructor(
    private readonly campaignRepo: PhotoCampaignRepository,
    private readonly itemRepo: CampaignItemRepository,
    private readonly photoRepo: CampaignPhotoRepository,
    private readonly generatorUrl: string,
    private readonly internalSecret: string,
    private readonly retentionDays: number = CANCELLED_CAMPAIGN_PHOTO_RETENTION_DAYS,
  ) {}

  async execute(): Promise<CleanupCancelledCampaignPhotosResult> {
    const cutoff = new Date(Date.now() - this.retentionDays * 24 * 60 * 60 * 1000)
    const campaigns = await this.campaignRepo.findCancelledForPhotoCleanup(cutoff)

    let blobsDeleted = 0
    let blobsFailed = 0

    for (const campaign of campaigns) {
      const items = await this.itemRepo.findByCampaign(campaign.id)
      const protectedPhotoIds = new Set(
        items.filter((item) => item.status === 'materialized').flatMap((item) => item.photoIds),
      )

      const photos = await this.photoRepo.findByCampaign(campaign.id)
      const deletable = photos.filter((photo) => !protectedPhotoIds.has(photo.id))

      for (const photo of deletable) {
        try {
          await fetchInternal(`${this.generatorUrl}/images/delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Internal-Secret': this.internalSecret },
            body: JSON.stringify({ path: photo.storagePath }),
          })
          blobsDeleted++
        } catch {
          blobsFailed++
        }
      }

      await this.campaignRepo.save({ ...campaign, photosDeletedAt: new Date() })
    }

    return { campaignsCleaned: campaigns.length, blobsDeleted, blobsFailed }
  }
}
