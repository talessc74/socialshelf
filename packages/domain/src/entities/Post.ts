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
  brandProfileVersion: number | null
  content: PlatformContent[]
  imageStoragePaths: string[]
  status: PostStatus
  scheduledAt: Date | null
  publishedAt: Date | null
  externalIds: Partial<Record<Platform, string>>
  // URL do artigo de notícia que originou este post, quando criado a partir de uma sugestão de
  // pauta. Usado para marcar, na tela de notícias, que esse artigo já gerou um post publicado.
  sourceArticleUrl: string | null
  createdAt: Date
  updatedAt: Date
}
