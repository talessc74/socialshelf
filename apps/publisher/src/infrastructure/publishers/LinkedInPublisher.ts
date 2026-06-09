import { Platform } from '@socialshelf/domain'
import type { PublisherPort, PublishResult, Post, OAuthConnection, TokenVaultPort } from '@socialshelf/domain'

const LI_REST = 'https://api.linkedin.com/rest'
const LI_ME = 'https://api.linkedin.com/v2/me'
const LI_VERSION = '202401'

interface LinkedInToken {
  access_token: string
}

export class LinkedInPublisher implements PublisherPort {
  constructor(private readonly tokenVault: TokenVaultPort) {}

  async publish(post: Post, platform: Platform, connection: OAuthConnection): Promise<PublishResult> {
    const raw = await this.tokenVault.retrieve(connection.tokenRef)
    const token: LinkedInToken = JSON.parse(raw)

    const text = post.content.find((c) => c.platform === Platform.LINKEDIN)?.text ?? ''
    const personId = await this.getPersonId(token.access_token)

    const body = {
      author: `urn:li:person:${personId}`,
      commentary: text,
      visibility: 'PUBLIC',
      distribution: {
        feedDistribution: 'MAIN_FEED',
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      lifecycleState: 'PUBLISHED',
      isReshareDisabledByAuthor: false,
    }

    const response = await fetch(`${LI_REST}/posts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token.access_token}`,
        'Content-Type': 'application/json',
        'LinkedIn-Version': LI_VERSION,
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`LinkedIn publish failed: ${response.status} ${err}`)
    }

    // New REST API returns the post URN in the x-restli-id response header
    const postUrn = response.headers.get('x-restli-id') ?? response.headers.get('location') ?? 'unknown'
    return { externalId: postUrn, publishedAt: new Date() }
  }

  private async getPersonId(accessToken: string): Promise<string> {
    const response = await fetch(LI_ME, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!response.ok) {
      throw new Error(`LinkedIn /me failed: ${response.status}`)
    }

    const data = (await response.json()) as { id: string }
    return data.id
  }
}
