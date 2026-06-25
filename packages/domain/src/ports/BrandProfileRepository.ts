import type { BrandProfile } from '../entities/BrandProfile.js'

export interface BrandProfileRepository {
  save(profile: BrandProfile): Promise<void>
  findLatestByBrand(userId: string, brandId: string): Promise<BrandProfile | null>
  findByBrandAndVersion(userId: string, brandId: string, version: number): Promise<BrandProfile | null>
}
