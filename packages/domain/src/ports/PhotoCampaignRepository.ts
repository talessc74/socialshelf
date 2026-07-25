import type { PhotoCampaign } from '../entities/PhotoCampaign.js'

export interface PhotoCampaignRepository {
  save(campaign: PhotoCampaign): Promise<void>
  findById(id: string): Promise<PhotoCampaign | null>
  findByIdAndBrand(id: string, userId: string, brandId: string): Promise<PhotoCampaign | null>
  findByBrand(userId: string, brandId: string): Promise<PhotoCampaign[]>
  /**
   * Campanhas canceladas há mais de `cutoff` cujas fotos ainda não foram apagadas
   * (photosDeletedAt null) — usado pela limpeza diária de storage (_local-edr-policy-067).
   */
  findCancelledForPhotoCleanup(cutoff: Date): Promise<PhotoCampaign[]>
  /**
   * Apaga o documento da campanha — usado por DiscardCampaignUseCase ao descartar uma
   * campanha cancelada (_local-edr-policy-069). Só o documento da campanha; CampaignPhoto
   * e CampaignItem são apagados à parte pelo use case, cada um com sua própria regra.
   */
  delete(userId: string, brandId: string, id: string): Promise<void>
}
