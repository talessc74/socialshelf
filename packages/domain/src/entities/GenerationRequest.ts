import type { Platform } from './Platform.js'

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
  error: string | null
}

export interface PlatformCopy {
  text: string
  charCount: number
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
    artifactCount: number
    topicSuggestionId: string | null
  }
  outputs: {
    copies: Partial<Record<Platform, PlatformCopy>>
    cta: string | null
    headline: string | null
    artifacts: GenerationArtifact[]
  } | null
  error: string | null
  createdAt: Date
  updatedAt: Date
}
