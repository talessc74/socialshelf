import type { AudienceSignal } from '../entities/AudienceSignal.js'
import type { Platform } from '../entities/Platform.js'

export interface AudienceSignalRepository {
  save(signal: AudienceSignal): Promise<void>
  findLatestByBrandAndPlatform(brandId: string, platform: Platform): Promise<AudienceSignal | null>
}
