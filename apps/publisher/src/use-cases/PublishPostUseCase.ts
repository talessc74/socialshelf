import { Platform } from '@socialshelf/domain'
import type {
  PostRepository,
  OAuthRepository,
  TokenVaultPort,
  PublisherPort,
  PublishResult,
} from '@socialshelf/domain'

export interface PlatformPublishResult {
  platform: Platform
  externalId: string
  publishedAt: Date
}

export interface PublishPostResult {
  postId: string
  results: PlatformPublishResult[]
  failedPlatforms: Array<{ platform: Platform; reason: string }>
}

export class PublishPostUseCase {
  private publishers: Map<Platform, PublisherPort>

  constructor(
    private readonly postRepo: PostRepository,
    private readonly oauthRepo: OAuthRepository,
    private readonly tokenVault: TokenVaultPort,
    publishers: Map<Platform, PublisherPort>,
  ) {
    this.publishers = publishers
  }

  async execute(postId: string, brandId: string): Promise<PublishPostResult> {
    const post = await this.postRepo.findById(postId)
    if (!post) throw new Error(`Post not found: ${postId}`)

    const results: PlatformPublishResult[] = []
    const failedPlatforms: Array<{ platform: Platform; reason: string }> = []

    for (const content of post.content) {
      const { platform } = content
      const publisher = this.publishers.get(platform)

      if (!publisher) {
        failedPlatforms.push({ platform, reason: `No publisher registered for ${platform}` })
        continue
      }

      try {
        const connection = await this.oauthRepo.findByBrandAndPlatform(brandId, platform)
        if (!connection) {
          failedPlatforms.push({ platform, reason: `No OAuth connection for ${platform}` })
          continue
        }

        const result: PublishResult = await publisher.publish(post, platform, connection)
        results.push({ platform, ...result })
        post.externalIds[platform] = result.externalId
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err)
        failedPlatforms.push({ platform, reason })
      }
    }

    const allFailed = results.length === 0 && failedPlatforms.length > 0
    post.status = allFailed ? 'failed' : 'published'
    post.publishedAt = allFailed ? null : new Date()
    post.updatedAt = new Date()

    await this.postRepo.save(post)

    return { postId, results, failedPlatforms }
  }
}
