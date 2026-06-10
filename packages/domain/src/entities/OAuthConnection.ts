import type { Platform } from './Platform.js'

export interface OAuthConnection {
  id: string
  userId: string
  brandId: string
  platform: Platform
  pairwiseId: string
  tokenRef: string
  scopes: string[]
  expiresAt: Date | null
  createdAt: Date
  updatedAt: Date
}
