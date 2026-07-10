import type { CampaignPhoto } from '../entities/CampaignPhoto.js'

export interface CampaignPhotoRepository {
  save(photo: CampaignPhoto): Promise<void>
  saveAll(photos: CampaignPhoto[]): Promise<void>
  findByCampaign(campaignId: string): Promise<CampaignPhoto[]>
}
