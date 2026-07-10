import type { Platform } from './Platform.js'
import type { AspectRatio } from './AspectRatio.js'
import type { TemplateStyle } from './TemplateStyle.js'

export type GenerationStatus =
  | 'pending'
  | 'generating_copy'
  | 'generating_image'
  | 'ready'
  | 'failed'

export type ArtifactStatus = 'pending' | 'generating' | 'ready' | 'failed'

export interface GenerationArtifact {
  position: number
  status: ArtifactStatus
  imageStoragePath: string | null
  backgroundImageStoragePath: string | null
  error: string | null
}

export interface PlatformCopy {
  text: string
  charCount: number
}

// Vídeo montado a partir dos artefatos de imagem desta geração (_local-edr-policy-036).
// Um único vídeo por GenerationRequest, não por posição — por isso fica fora de
// GenerationArtifact[], que é por-imagem.
export interface ComposedVideo {
  storagePath: string
  durationSeconds: number
  narrated: boolean
}

export interface GenerationRequest {
  id: string
  userId: string
  brandId: string
  status: GenerationStatus
  inputs: {
    description: string
    textContent: string | null
    imageStoragePaths: string[]
    targetPlatforms: Platform[]
    topicSuggestionId: string | null
    aspectRatio: AspectRatio
    style: TemplateStyle
    includeBodyText: boolean
  }
  outputs: {
    copies: Partial<Record<Platform, PlatformCopy>>
    cta: string | null
    headlines: string[] | null
    visualBriefs: string[] | null
    bodyTexts: string[] | null
    artifacts: GenerationArtifact[]
    composedVideo?: ComposedVideo | null
  } | null
  error: string | null
  createdAt: Date
  updatedAt: Date
}
