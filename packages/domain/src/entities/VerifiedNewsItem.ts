import type { NewsItem } from './NewsItem.js'

export interface VerifiedNewsItem extends NewsItem {
  sourceDomain: string
  verifiedAt: Date
}
