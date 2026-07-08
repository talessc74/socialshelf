import { randomUUID } from 'crypto'
import { exchangeCodeForTikTokToken } from '../../lib/tiktok-client.js'
import { Platform, derivePairwiseId } from '@socialshelf/domain'
import type { OAuthConnection, OAuthRepository, TokenVaultPort } from '@socialshelf/domain'

export class HandleTikTokCallbackUseCase {
  constructor(
    private readonly oauthRepo: OAuthRepository,
    private readonly tokenVault: TokenVaultPort,
  ) {}

  async execute(
    code: string,
    codeVerifier: string,
    userId: string,
    brandId: string,
  ): Promise<OAuthConnection> {
    const tokenResponse = await exchangeCodeForTikTokToken(code, codeVerifier)

    // pairwiseId segue o mesmo padrão determinístico das demais plataformas
    // (ADR-017: SHA256(userId:platform)) — nunca o open_id/union_id devolvido
    // pelo TikTok. union_id, quando presente na resposta, não é lido nem
    // persistido em lugar nenhum: é um identificador de rastreamento cruzado
    // entre apps do mesmo desenvolvedor TikTok (ADR-034), incompatível com o
    // modelo pairwise (ADR-007).
    const pairwiseId = derivePairwiseId(userId, Platform.TIKTOK)
    const tokenRef = `oauth-token-${pairwiseId}`

    const expiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000)

    await this.tokenVault.store(
      tokenRef,
      JSON.stringify({
        access_token: tokenResponse.access_token,
        refresh_token: tokenResponse.refresh_token,
        expires_at: expiresAt.toISOString(),
        open_id: tokenResponse.open_id,
        scope: tokenResponse.scope,
      }),
    )

    const connection: OAuthConnection = {
      id: randomUUID(),
      userId,
      brandId,
      platform: Platform.TIKTOK,
      pairwiseId,
      tokenRef,
      scopes: tokenResponse.scope.split(','),
      expiresAt,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    await this.oauthRepo.save(connection)

    return connection
  }
}
