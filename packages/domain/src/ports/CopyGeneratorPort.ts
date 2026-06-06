import type { Platform } from '../entities/Platform.js'
import type { PlatformCopy } from '../entities/GenerationRequest.js'

export interface ContentInputs {
  description: string
  textContent?: string
  images: Array<{ base64: string; mimeType: string }>
  targetPlatforms: Platform[]
}

export type PlatformCopies = Partial<Record<Platform, PlatformCopy>>

export interface CopyGeneratorPort {
  generateCopy(inputs: ContentInputs): Promise<PlatformCopies>
}
