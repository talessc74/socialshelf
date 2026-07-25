import type { CampaignPhoto } from '../entities/CampaignPhoto.js'

export interface CampaignPhotoRepository {
  save(photo: CampaignPhoto): Promise<void>
  saveAll(photos: CampaignPhoto[]): Promise<void>
  findByCampaign(campaignId: string): Promise<CampaignPhoto[]>
  delete(userId: string, brandId: string, campaignId: string, photoId: string): Promise<CampaignPhoto | null>
  /**
   * Apaga todos os registros de foto da campanha de uma vez — usado ao descartar uma
   * campanha cancelada (_local-edr-policy-069). Não mexe nos blobs em Cloud Storage; quem
   * chama decide quais blobs apagar antes (uma foto ainda referenciada por um Post real
   * mantém o blob, só o registro de bookkeeping da campanha some).
   */
  deleteByCampaign(userId: string, brandId: string, campaignId: string): Promise<void>
  countByCampaign(userId: string, brandId: string, campaignId: string): Promise<number>
  reorder(userId: string, brandId: string, campaignId: string, orderedPhotoIds: string[]): Promise<void>
}
