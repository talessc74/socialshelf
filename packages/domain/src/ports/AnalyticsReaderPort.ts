import type { OAuthConnection } from '../entities/OAuthConnection.js'

export interface PostMetrics {
  impressions: number
  likes: number
  comments: number
  shares: number
}

// Thrown by an AnalyticsReaderPort implementation when the platform reports that the
// published content no longer exists (e.g. the user deleted the post directly on
// Instagram/Facebook) — distinct from transient failures (expired token, rate limit,
// network) so callers can react differently: stop retrying and clean up the stale
// externalId instead of surfacing a scary, permanent-looking error to the user.
export class ContentNotFoundError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ContentNotFoundError'
  }
}

export interface AnalyticsReaderPort {
  fetchPostMetrics(externalId: string, connection: OAuthConnection): Promise<PostMetrics>
}
