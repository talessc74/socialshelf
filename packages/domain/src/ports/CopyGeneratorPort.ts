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
  artifactCount: number
  pautaContext: PautaContext | null
  brandVoice: BrandProfileVoice | null
}

export type PlatformCopies = Partial<Record<Platform, PlatformCopy>>

export interface CopyGenerationResult {
  copies: PlatformCopies
  cta: string
  /**
   * Um headline curto (~80 caracteres) por artefato, na ordem dos slides — sempre
   * `length === artifactCount`. Em carrossel, formam uma sequência narrativa (gancho →
   * desenvolvimento → fechamento), não N variações do mesmo texto.
   */
  headlines: string[]
}

export interface CopyGeneratorPort {
  generateCopy(inputs: ContentInputs): Promise<CopyGenerationResult>
}
