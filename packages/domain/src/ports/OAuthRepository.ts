import type { OAuthConnection } from '../entities/OAuthConnection.js'
import type { Platform } from '../entities/Platform.js'

export interface OAuthRepository {
  save(connection: OAuthConnection): Promise<void>
  findById(id: string): Promise<OAuthConnection | null>
  findByPairwise(pairwiseId: string): Promise<OAuthConnection | null>
  findByBrandAndPlatform(
    brandId: string,
    platform: Platform,
  ): Promise<OAuthConnection | null>
  findByBrand(brandId: string): Promise<OAuthConnection[]>
  delete(id: string): Promise<void>
}
