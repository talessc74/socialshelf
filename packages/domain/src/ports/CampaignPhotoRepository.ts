import type { CampaignPhoto } from '../entities/CampaignPhoto.js'

export interface CampaignPhotoRepository {
  save(photo: CampaignPhoto): Promise<void>
  saveAll(photos: CampaignPhoto[]): Promise<void>
  findByCampaign(campaignId: string): Promise<CampaignPhoto[]>
  delete(userId: string, brandId: string, campaignId: string, photoId: string): Promise<CampaignPhoto | null>
}
