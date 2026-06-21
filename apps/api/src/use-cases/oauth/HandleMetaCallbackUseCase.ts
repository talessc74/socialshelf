import { randomUUID } from 'crypto'
import { validateState } from '../../lib/csrf.js'
import {
  exchangeCodeForShortLivedToken,
  exchangeShortForLongLived,
  getUserPages,
} from '../../lib/meta-client.js'
import { Platform, derivePairwiseId } from '@socialshelf/domain'
import type { OAuthConnection, OAuthRepository, TokenVaultPort } from '@socialshelf/domain'

export interface MetaCallbackResult {
  facebook: OAuthConnection | null
  instagram: OAuthConnection | null
}

export class HandleMetaCallbackUseCase {
  constructor(
    private readonly oauthRepo: OAuthRepository,
    private readonly tokenVault: TokenVaultPort,
  ) {}

  async execute(
    code: string,
    state: string,
    brandId: string,
  ): Promise<MetaCallbackResult> {
    const { userId } = validateState(state)
    const redirectUri = process.env['META_REDIRECT_URI'] ?? ''

    // 1. Short-lived → long-lived user token (60 days)
    const shortLived = await exchangeCodeForShortLivedToken(code, redirectUri)
    const longLived = await exchangeShortForLongLived(shortLived.access_token)

    // Algumas respostas da Meta (ex.: fluxo de Business Login, ou reconexão de um token
    // já de longa duração) não retornam expires_in, ou retornam 0/valor fora de um intervalo
    // plausível — nesses casos o token é tratado como de longa duração por padrão (60 dias).
    // Sem este saneamento, um expires_in inesperado produzia uma Date inválida e a conexão
    // falhava com "Invalid time value" ao serializar para o Firestore.
    const SIXTY_DAYS_IN_SECONDS = 60 * 24 * 60 * 60
    const ONE_YEAR_IN_SECONDS = 365 * 24 * 60 * 60
    const isPlausibleExpiry =
      typeof longLived.expires_in === 'number' &&
      Number.isFinite(longLived.expires_in) &&
      longLived.expires_in > 0 &&
      longLived.expires_in <= ONE_YEAR_IN_SECONDS
    const expiresInSeconds = isPlausibleExpiry ? longLived.expires_in : SIXTY_DAYS_IN_SECONDS
    let expiresAt = new Date(Date.now() + expiresInSeconds * 1000)
    if (Number.isNaN(expiresAt.getTime())) {
      expiresAt = new Date(Date.now() + SIXTY_DAYS_IN_SECONDS * 1000)
    }

    // 2. Fetch pages the user manages (includes page tokens + Instagram links)
    const pages = await getUserPages(longLived.access_token)

    let facebookConnection: OAuthConnection | null = null
    let instagramConnection: OAuthConnection | null = null

    if (pages.length > 0) {
      // Use the first page for this brand (user selects page in UI later)
      const page = pages[0]!

      // 3. Save Facebook connection with page access token
      const fbPairwiseId = derivePairwiseId(userId, Platform.FACEBOOK)
      const fbTokenRef = `oauth-token-${fbPairwiseId}`

      await this.tokenVault.store(
        fbTokenRef,
        JSON.stringify({
          user_access_token: longLived.access_token,
          page_access_token: page.access_token,
          page_id: page.id,
          page_name: page.name,
          expires_at: expiresAt.toISOString(),
        }),
      )

      facebookConnection = {
        id: randomUUID(),
        userId,
        brandId,
        platform: Platform.FACEBOOK,
        pairwiseId: fbPairwiseId,
        tokenRef: fbTokenRef,
        scopes: ['pages_manage_posts', 'pages_read_engagement', 'pages_show_list'],
        expiresAt,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      await this.oauthRepo.save(facebookConnection)

      // 4. Save Instagram connection using whichever page has a Business Account linked
      //    (not necessarily the first page — a user can manage several Facebook Pages)
      const igPage = pages.find((p) => p.instagram_business_account) ?? null
      if (igPage?.instagram_business_account) {
        const igPairwiseId = derivePairwiseId(userId, Platform.INSTAGRAM)
        const igTokenRef = `oauth-token-${igPairwiseId}`

        await this.tokenVault.store(
          igTokenRef,
          JSON.stringify({
            user_access_token: longLived.access_token,
            page_access_token: igPage.access_token,
            instagram_business_account_id: igPage.instagram_business_account.id,
            page_id: igPage.id,
            expires_at: expiresAt.toISOString(),
          }),
        )

        instagramConnection = {
          id: randomUUID(),
          userId,
          brandId,
          platform: Platform.INSTAGRAM,
          pairwiseId: igPairwiseId,
          tokenRef: igTokenRef,
          scopes: ['instagram_basic', 'instagram_content_publish'],
          expiresAt,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
        await this.oauthRepo.save(instagramConnection)
      }
    }

    return { facebook: facebookConnection, instagram: instagramConnection }
  }
}
