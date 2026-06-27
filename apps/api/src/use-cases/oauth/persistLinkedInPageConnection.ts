import { randomUUID } from 'crypto'
import { Platform, derivePairwiseId } from '@socialshelf/domain'
import type { OAuthConnection, OAuthRepository, TokenVaultPort } from '@socialshelf/domain'

export interface LinkedInPageTokenInfo {
  access_token: string
  refresh_token?: string | null
  expires_in: number
  scope: string
}

// Reaproveita o mesmo pairwiseId/tokenRef da conexão pessoal — uma marca tem só uma
// conexão LinkedIn por vez, e escolher publicar como Página substitui o perfil pessoal.
export async function persistLinkedInPageConnection(
  oauthRepo: OAuthRepository,
  tokenVault: TokenVaultPort,
  userId: string,
  brandId: string,
  tokenInfo: LinkedInPageTokenInfo,
  organizationUrn: string,
): Promise<OAuthConnection> {
  const pairwiseId = derivePairwiseId(userId, Platform.LINKEDIN)
  const tokenRef = `oauth-token-${pairwiseId}`

  await tokenVault.store(
    tokenRef,
    JSON.stringify({
      access_token: tokenInfo.access_token,
      refresh_token: tokenInfo.refresh_token ?? null,
      expires_at: Date.now() + tokenInfo.expires_in * 1000,
      scope: tokenInfo.scope,
    }),
  )

  const connection: OAuthConnection = {
    id: randomUUID(),
    userId,
    brandId,
    platform: Platform.LINKEDIN,
    pairwiseId,
    tokenRef,
    scopes: tokenInfo.scope.split(' '),
    organizationUrn,
    expiresAt: new Date(Date.now() + tokenInfo.expires_in * 1000),
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  await oauthRepo.save(connection)
  return connection
}
