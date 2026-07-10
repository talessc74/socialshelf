import type { CampaignItem } from '../entities/CampaignItem.js'

export interface CampaignItemRepository {
  save(item: CampaignItem): Promise<void>
  saveAll(items: CampaignItem[]): Promise<void>
  findByCampaign(campaignId: string): Promise<CampaignItem[]>
  deleteByCampaign(campaignId: string): Promise<void>
}
