import type { Platform } from '../entities/Platform.js'
import type { PlatformCopy } from '../entities/GenerationRequest.js'

export interface PautaContext {
  headline: string
  rationale: string
}

export interface ContentInputs {
  description: string
  textContent?: string
  images: Array<{ base64: string; mimeType: string }>
  targetPlatforms: Platform[]
  format: 'single' | 'carousel'
  pautaContext: PautaContext | null
}

export type PlatformCopies = Partial<Record<Platform, PlatformCopy>>

export interface CopyGenerationResult {
  copies: PlatformCopies
  cta: string
}

export interface CopyGeneratorPort {
  generateCopy(inputs: ContentInputs): Promise<CopyGenerationResult>
}
