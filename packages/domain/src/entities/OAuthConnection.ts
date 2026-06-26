import type { Platform } from './Platform.js'

export interface OAuthConnection {
  id: string
  userId: string
  brandId: string
  platform: Platform
  pairwiseId: string
  tokenRef: string
  scopes: string[]
  organizationUrn?: string | null
  expiresAt: Date | null
  createdAt: Date
  updatedAt: Date
}
