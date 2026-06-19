import type { OAuthConnection } from '../entities/OAuthConnection.js'

export interface PostMetrics {
  impressions: number
  likes: number
  comments: number
  shares: number
}

export interface AnalyticsReaderPort {
  fetchPostMetrics(externalId: string, connection: OAuthConnection): Promise<PostMetrics>
}
