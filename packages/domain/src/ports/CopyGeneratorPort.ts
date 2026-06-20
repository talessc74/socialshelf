import type { Platform } from '../entities/Platform.js'
import type { PlatformCopy } from '../entities/GenerationRequest.js'
import type { BrandProfileVoice } from '../entities/BrandProfile.js'

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
  brandVoice: BrandProfileVoice | null
}

export type PlatformCopies = Partial<Record<Platform, PlatformCopy>>

export interface CopyGenerationResult {
  copies: PlatformCopies
  cta: string
  /** Headline curto (~80 caracteres), compartilhado entre plataformas, distinto da legenda completa por plataforma. */
  headline: string
}

export interface CopyGeneratorPort {
  generateCopy(inputs: ContentInputs): Promise<CopyGenerationResult>
}
