import type { CampaignItemRepository, CampaignPhotoRepository, PhotoCampaignRepository } from '@socialshelf/domain'
import { fetchInternal } from '../../lib/serviceAuth.js'

export interface DiscardCampaignInput {
  userId: string
  brandId: string
  campaignId: string
}

// _local-edr-policy-069: versão sob demanda de CleanupCancelledCampaignPhotosUseCase — em vez
// de esperar o prazo de retenção (_local-edr-policy-067), o usuário pede pra apagar a campanha
// cancelada agora. Mesmo invariante de segurança: uma foto cujo CampaignItem ficou
// 'materialized' é o mesmo blob referenciado por um Post real (ver materializeCampaignItems) —
// o blob nunca é apagado aqui, só o registro de bookkeeping da campanha (CampaignPhoto,
// CampaignItem, e a própria campanha) some por completo, ao contrário da limpeza automática que
// só marca photosDeletedAt e preserva os documentos como histórico.
export class DiscardCampaignUseCase {
  constructor(
    private readonly campaignRepo: PhotoCampaignRepository,
    private readonly itemRepo: CampaignItemRepository,
    private readonly photoRepo: CampaignPhotoRepository,
    private readonly generatorUrl: string,
    private readonly internalSecret: string,
  ) {}

  async execute(input: DiscardCampaignInput): Promise<void> {
    const campaign = await this.campaignRepo.findByIdAndBrand(input.campaignId, input.userId, input.brandId)
    if (!campaign) throw new Error('Campaign not found')
    if (campaign.status !== 'cancelled') {
      throw new Error('Only cancelled campaigns can be discarded')
    }

    const items = await this.itemRepo.findByCampaign(campaign.id)
    const protectedPhotoIds = new Set(
      items.filter((item) => item.status === 'materialized').flatMap((item) => item.photoIds),
    )

    const photos = await this.photoRepo.findByCampaign(campaign.id)
    const deletableBlobs = photos.filter((photo) => !protectedPhotoIds.has(photo.id))

    for (const photo of deletableBlobs) {
      try {
        await fetchInternal(`${this.generatorUrl}/images/delete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Internal-Secret': this.internalSecret },
          body: JSON.stringify({ path: photo.storagePath }),
        })
      } catch {
        // Best-effort, mesmo padrão de DeleteCampaignPhotoUseCase e do tick de limpeza: o
        // registro de bookkeeping some de qualquer forma. Diferente do tick diário, porém,
        // uma falha aqui não tem uma segunda chance — a campanha (âncora da varredura
        // automática) já deixou de existir ao final deste método, então um blob que falhar
        // fica órfão de vez, não apenas até o próximo tick.
      }
    }

    await this.itemRepo.deleteByCampaign(campaign.id)
    await this.photoRepo.deleteByCampaign(input.userId, input.brandId, campaign.id)
    await this.campaignRepo.delete(input.userId, input.brandId, campaign.id)
  }
}
