import type { Platform } from './Platform.js'

export type PostStatus = 'draft' | 'ai-draft' | 'scheduled' | 'published' | 'failed'

export interface PlatformContent {
  platform: Platform
  text: string
  charCount: number
}

export interface Post {
  id: string
  userId: string
  brandId: string
  content: PlatformContent[]
  imageStoragePaths: string[]
  status: PostStatus
  scheduledAt: Date | null
  publishedAt: Date | null
  externalIds: Partial<Record<Platform, string>>
  createdAt: Date
  updatedAt: Date
}
