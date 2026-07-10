import type { PhotoCampaign } from '../entities/PhotoCampaign.js'

export interface PhotoCampaignRepository {
  save(campaign: PhotoCampaign): Promise<void>
  findById(id: string): Promise<PhotoCampaign | null>
  findByIdAndBrand(id: string, userId: string, brandId: string): Promise<PhotoCampaign | null>
  findByBrand(userId: string, brandId: string): Promise<PhotoCampaign[]>
}
