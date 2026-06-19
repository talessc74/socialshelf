import { randomUUID } from 'node:crypto'
import type {
  Platform,
  PostRepository,
  OAuthRepository,
  AnalyticsReaderPort,
  AudienceSignalRepository,
  AudienceSignal,
} from '@socialshelf/domain'

export class ComputeAudienceSignalUseCase {
  constructor(
    private readonly postRepo: PostRepository,
    private readonly oauthRepo: OAuthRepository,
    private readonly audienceSignalRepo: AudienceSignalRepository,
    private readonly readers: Map<Platform, AnalyticsReaderPort>,
  ) {}

  async execute(brandId: string, platform: Platform): Promise<AudienceSignal> {
    const reader = this.readers.get(platform)
    if (!reader) throw new Error(`No analytics reader registered for ${platform}`)

    const connection = await this.oauthRepo.findByBrandAndPlatform(brandId, platform)
    if (!connection) throw new Error(`No OAuth connection for ${platform}`)

    const publishedPosts = await this.postRepo.findByBrand(brandId, 'published')
    const postsWithExternalId = publishedPosts.filter((post) => post.externalIds[platform])

    let totalImpressions = 0
    let totalEngagements = 0
    let postsAnalyzed = 0

    for (const post of postsWithExternalId) {
      const externalId = post.externalIds[platform]!
      const metrics = await reader.fetchPostMetrics(externalId, connection)
      totalImpressions += metrics.impressions
      totalEngagements += metrics.likes + metrics.comments + metrics.shares
      postsAnalyzed += 1
    }

    const avgEngagementRate = totalImpressions > 0 ? totalEngagements / totalImpressions : 0

    const signal: AudienceSignal = {
      id: randomUUID(),
      brandId,
      platform,
      postsAnalyzed,
      totalImpressions,
      totalEngagements,
      avgEngagementRate,
      computedAt: new Date(),
    }

    await this.audienceSignalRepo.save(signal)

    return signal
  }
}
