import type {
  Platform,
  PostRepository,
  OAuthRepository,
  AnalyticsReaderPort,
  PostMetrics,
} from '@socialshelf/domain'

export interface PostPerformanceEntry {
  postId: string
  platform: Platform
  text: string
  metrics: PostMetrics
  score: number
  publishedAt: string
}

export class GetPostsPerformanceUseCase {
  constructor(
    private readonly postRepo: PostRepository,
    private readonly oauthRepo: OAuthRepository,
    private readonly readers: Map<Platform, AnalyticsReaderPort>,
  ) {}

  async execute(brandId: string): Promise<PostPerformanceEntry[]> {
    const publishedPosts = await this.postRepo.findByBrand(brandId, 'published')
    const entries: PostPerformanceEntry[] = []

    for (const post of publishedPosts) {
      for (const [platformKey, externalId] of Object.entries(post.externalIds)) {
        const platform = platformKey as Platform
        const reader = this.readers.get(platform)
        if (!reader || !externalId) continue

        const connection = await this.oauthRepo.findByBrandAndPlatform(brandId, platform)
        if (!connection) continue

        const metrics = await reader.fetchPostMetrics(externalId, connection)
        const content = post.content.find((c) => c.platform === platform)

        entries.push({
          postId: post.id,
          platform,
          text: content?.text ?? '',
          metrics,
          score: metrics.impressions + metrics.likes + metrics.comments + metrics.shares,
          publishedAt: (post.publishedAt ?? post.updatedAt).toISOString(),
        })
      }
    }

    return entries.sort((a, b) => b.score - a.score)
  }
}
