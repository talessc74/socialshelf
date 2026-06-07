import { Platform } from '@socialshelf/domain'
import type { PublisherPort, PublishResult, Post, OAuthConnection, TokenVaultPort } from '@socialshelf/domain'

const LI_API = 'https://api.linkedin.com/v2'

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
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text },
          shareMediaCategory: 'NONE',
        },
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
      },
    }

    const response = await fetch(`${LI_API}/ugcPosts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token.access_token}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`LinkedIn publish failed: ${response.status} ${err}`)
    }

    const data = (await response.json()) as { id: string }
    return { externalId: data.id, publishedAt: new Date() }
  }

  private async getPersonId(accessToken: string): Promise<string> {
    const response = await fetch(`${LI_API}/userinfo`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!response.ok) {
      throw new Error(`LinkedIn userinfo failed: ${response.status}`)
    }

    const data = (await response.json()) as { sub: string }
    return data.sub
  }
}
