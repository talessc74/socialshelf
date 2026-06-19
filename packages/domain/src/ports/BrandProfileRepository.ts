import type { BrandProfile } from '../entities/BrandProfile.js'

export interface BrandProfileRepository {
  save(profile: BrandProfile): Promise<void>
  findLatestByBrand(brandId: string): Promise<BrandProfile | null>
  findByBrandAndVersion(brandId: string, version: number): Promise<BrandProfile | null>
}
