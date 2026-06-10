import type { Platform } from './Platform.js'

export type GenerationStatus =
  | 'pending'
  | 'generating_copy'
  | 'generating_image'
  | 'ready'
  | 'failed'

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
  }
  outputs: {
    copies: Partial<Record<Platform, PlatformCopy>>
    generatedImagePath: string | null
  } | null
  error: string | null
  createdAt: Date
  updatedAt: Date
}
