import type { OAuthConnection } from '../entities/OAuthConnection.js'
import type { Platform } from '../entities/Platform.js'

export interface OAuthRepository {
  save(connection: OAuthConnection): Promise<void>
  findById(id: string): Promise<OAuthConnection | null>
  findByPairwise(pairwiseId: string): Promise<OAuthConnection | null>
  findByBrandAndPlatform(
    userId: string,
    brandId: string,
    platform: Platform,
  ): Promise<OAuthConnection | null>
  findByBrand(userId: string, brandId: string): Promise<OAuthConnection[]>
  delete(id: string): Promise<void>
}
