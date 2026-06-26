import type { AnalyticsReaderPort, PostMetrics, OAuthConnection, TokenVaultPort } from '@socialshelf/domain'

const LI_REST = 'https://api.linkedin.com/rest'
const LI_VERSION = '202602'

interface LinkedInToken {
  access_token: string
}

interface LinkedInSocialActions {
  likesSummary: { totalLikes: number }
  commentsSummary: { totalFirstLevelComments: number }
}

export class LinkedInAnalyticsReader implements AnalyticsReaderPort {
  constructor(private readonly tokenVault: TokenVaultPort) {}

  async fetchPostMetrics(externalId: string, connection: OAuthConnection): Promise<PostMetrics> {
    const raw = await this.tokenVault.retrieve(connection.tokenRef)
    const token: LinkedInToken = JSON.parse(raw)

    const response = await fetch(`${LI_REST}/socialActions/${encodeURIComponent(externalId)}`, {
      headers: {
        Authorization: `Bearer ${token.access_token}`,
        'LinkedIn-Version': LI_VERSION,
      },
    })

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`LinkedIn metrics fetch failed: ${response.status} ${err}`)
    }

    const data = (await response.json()) as LinkedInSocialActions

    // socialActions não expõe impressões nem reposts para posts de membro — apenas reactions/comments
    return {
      impressions: 0,
      likes: data.likesSummary.totalLikes,
      comments: data.commentsSummary.totalFirstLevelComments,
      shares: 0,
    }
  }
}
