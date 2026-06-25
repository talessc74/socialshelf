import type { AudienceSignal } from '../entities/AudienceSignal.js'
import type { Platform } from '../entities/Platform.js'

export interface AudienceSignalRepository {
  save(userId: string, signal: AudienceSignal): Promise<void>
  findLatestByBrandAndPlatform(userId: string, brandId: string, platform: Platform): Promise<AudienceSignal | null>
}
