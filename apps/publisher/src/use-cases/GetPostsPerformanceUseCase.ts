import { ContentNotFoundError } from '@socialshelf/domain'
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

export interface PostPerformanceError {
  platform: Platform
  postId: string
  message: string
}

export interface PostsPerformanceResult {
  entries: PostPerformanceEntry[]
  errors: PostPerformanceError[]
}

export class GetPostsPerformanceUseCase {
  constructor(
    private readonly postRepo: PostRepository,
    private readonly oauthRepo: OAuthRepository,
    private readonly readers: Map<Platform, AnalyticsReaderPort>,
  ) {}

  async execute(brandId: string): Promise<PostsPerformanceResult> {
    const publishedPosts = await this.postRepo.findByBrand(brandId, 'published')
    const entries: PostPerformanceEntry[] = []
    const errors: PostPerformanceError[] = []

    for (const post of publishedPosts) {
      for (const [platformKey, externalId] of Object.entries(post.externalIds)) {
        const platform = platformKey as Platform
        const reader = this.readers.get(platform)
        if (!reader || !externalId) continue

        // Cada plataforma é isolada: uma falha de token expirado/API indisponível em
        // uma rede não pode impedir a exibição das métricas das demais redes.
        try {
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
        } catch (err) {
          if (err instanceof ContentNotFoundError) {
            // Content was deleted directly on the platform — not an error to show the
            // user, just a stale reference. Drop it so we stop trying to fetch it forever.
            delete post.externalIds[platform]
            await this.postRepo.save(post)
            continue
          }

          errors.push({
            platform,
            postId: post.id,
            message: err instanceof Error ? err.message : String(err),
          })
        }
      }
    }

    return { entries: entries.sort((a, b) => b.score - a.score), errors }
  }
}
