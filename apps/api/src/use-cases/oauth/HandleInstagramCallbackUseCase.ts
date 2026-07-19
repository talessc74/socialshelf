import { randomUUID } from 'crypto'
import { Platform, derivePairwiseId } from '@socialshelf/domain'
import { validateState } from '../../lib/csrf.js'
import {
  exchangeCodeForInstagramToken,
  exchangeForLongLivedInstagramToken,
  getInstagramProfile,
} from '../../lib/instagram-client.js'
import type { OAuthConnection, OAuthRepository, TokenVaultPort } from '@socialshelf/domain'

// Conexão direta do Instagram via "Login do Instagram" — sem Facebook (_local-edr-policy-057).
// Diferente do fluxo via Facebook Login (HandleMetaCallbackUseCase), aqui não existe Página nem
// escolha de Página: o token é da própria conta profissional do Instagram, e a conexão criada é
// só a do Instagram. O vault grava auth_kind: 'instagram_login' para o publisher/analytics
// saberem que devem falar com graph.instagram.com usando o token direto, em vez do
// page_access_token via graph.facebook.com.
export class HandleInstagramCallbackUseCase {
  constructor(
    private readonly oauthRepo: OAuthRepository,
    private readonly tokenVault: TokenVaultPort,
  ) {}

  async execute(code: string, state: string, brandId: string): Promise<OAuthConnection> {
    // Mesmo marcador de etapa do fluxo Meta: o detail do erro que chega ao usuário é só
    // err.message — sem isso, uma falha não diz em qual passo aconteceu.
    let step = 'validateState'
    try {
      const { userId } = validateState(state)
      const redirectUri = process.env['INSTAGRAM_REDIRECT_URI'] ?? ''

      step = 'exchangeCodeForInstagramToken'
      const shortLived = await exchangeCodeForInstagramToken(code, redirectUri)
      step = 'exchangeForLongLivedInstagramToken'
      const longLived = await exchangeForLongLivedInstagramToken(shortLived.access_token)

      // Mesmo saneamento de expiry do fluxo Meta: expires_in ausente/implausível vira 60 dias.
      step = 'computeExpiresAt'
      const SIXTY_DAYS_IN_SECONDS = 60 * 24 * 60 * 60
      const ONE_YEAR_IN_SECONDS = 365 * 24 * 60 * 60
      const isPlausibleExpiry =
        typeof longLived.expires_in === 'number' &&
        Number.isFinite(longLived.expires_in) &&
        longLived.expires_in > 0 &&
        longLived.expires_in <= ONE_YEAR_IN_SECONDS
      const expiresInSeconds = isPlausibleExpiry ? longLived.expires_in! : SIXTY_DAYS_IN_SECONDS
      let expiresAt = new Date(Date.now() + expiresInSeconds * 1000)
      if (Number.isNaN(expiresAt.getTime())) {
        expiresAt = new Date(Date.now() + SIXTY_DAYS_IN_SECONDS * 1000)
      }

      step = 'getInstagramProfile'
      const profile = await getInstagramProfile(longLived.access_token)
      const instagramUserId = String(profile.user_id ?? shortLived.user_id)

      step = 'persistConnection'
      const pairwiseId = derivePairwiseId(userId, Platform.INSTAGRAM)
      const tokenRef = `oauth-token-${pairwiseId}`

      await this.tokenVault.store(
        tokenRef,
        JSON.stringify({
          auth_kind: 'instagram_login',
          access_token: longLived.access_token,
          instagram_user_id: instagramUserId,
          username: profile.username,
          expires_at: expiresAt.toISOString(),
        }),
      )

      const connection: OAuthConnection = {
        id: randomUUID(),
        userId,
        brandId,
        platform: Platform.INSTAGRAM,
        pairwiseId,
        tokenRef,
        scopes: ['instagram_business_basic', 'instagram_business_content_publish'],
        accountLabel: profile.username ? `@${profile.username}` : null,
        expiresAt,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      await this.oauthRepo.save(connection)

      return connection
    } catch (err) {
      if (err instanceof Error) {
        err.message = `[step=${step}] ${err.message}`
      }
      throw err
    }
  }
}
