import { Platform } from '@socialshelf/domain'
import type { PublisherPort, PublishResult, Post, OAuthConnection, TokenVaultPort } from '@socialshelf/domain'

const X_API = 'https://api.twitter.com/2'

interface XToken {
  access_token: string
}

export class XPublisher implements PublisherPort {
  constructor(private readonly tokenVault: TokenVaultPort) {}

  async publish(post: Post, _platform: Platform, connection: OAuthConnection): Promise<PublishResult> {
    const raw = await this.tokenVault.retrieve(connection.tokenRef)
    const token: XToken = JSON.parse(raw)

    const text = post.content.find((c) => c.platform === Platform.TWITTER)?.text ?? ''

    const response = await fetch(`${X_API}/tweets`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    })

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`X publish failed: ${response.status} ${err}`)
    }

    const data = (await response.json()) as { data: { id: string } }
    return { externalId: data.data.id, publishedAt: new Date() }
  }
}
