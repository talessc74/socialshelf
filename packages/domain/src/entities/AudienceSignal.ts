import type { Platform } from './Platform.js'

export interface AudienceSignal {
  id: string
  brandId: string
  platform: Platform
  postsAnalyzed: number
  totalImpressions: number
  totalEngagements: number
  avgEngagementRate: number
  computedAt: Date
}
