import type { OAuthConnection } from '../entities/OAuthConnection.js'
import type { Post } from '../entities/Post.js'
import type { Platform } from '../entities/Platform.js'

export interface PublishResult {
  externalId: string
  publishedAt: Date
}

export interface PublisherPort {
  publish(
    post: Post,
    platform: Platform,
    connection: OAuthConnection,
  ): Promise<PublishResult>
}
