import { randomUUID } from 'crypto'
import { validateState } from '../../lib/csrf.js'
import {
  exchangeCodeForShortLivedToken,
  exchangeShortForLongLived,
  getUserPages,
  type MetaPage,
} from '../../lib/meta-client.js'
import { persistMetaPageConnection } from './persistMetaPageConnection.js'
import type { OAuthConnection, OAuthRepository, TokenVaultPort } from '@socialshelf/domain'

export type MetaCallbackResult =
  | { status: 'connected'; facebook: OAuthConnection | null; instagram: OAuthConnection | null }
  | { status: 'pending'; pendingId: string; pages: MetaPage[] }

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
    // O detail de erro retornado ao usuário é só `err.message` (ver meta.routes.ts) — sem
    // contexto, mensagens como "Invalid time value" não dizem em qual etapa a falha ocorreu.
    // Este marcador é incluído na mensagem de erro propagada para tornar diagnósticos futuros
    // possíveis sem acesso a logs do servidor.
    let step = 'validateState'
    try {
      const { userId } = validateState(state)
      const redirectUri = process.env['META_REDIRECT_URI'] ?? ''

      // 1. Short-lived → long-lived user token (60 days)
      step = 'exchangeCodeForShortLivedToken'
      const shortLived = await exchangeCodeForShortLivedToken(code, redirectUri)
      step = 'exchangeShortForLongLived'
      const longLived = await exchangeShortForLongLived(shortLived.access_token)

      // Algumas respostas da Meta (ex.: fluxo de Business Login, ou reconexão de um token
      // já de longa duração) não retornam expires_in, ou retornam 0/valor fora de um intervalo
      // plausível — nesses casos o token é tratado como de longa duração por padrão (60 dias).
      // Sem este saneamento, um expires_in inesperado produzia uma Date inválida e a conexão
      // falhava com "Invalid time value" ao serializar para o Firestore.
      step = 'computeExpiresAt'
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
      step = 'getUserPages'
      const pages = await getUserPages(longLived.access_token)

      if (pages.length === 0) {
        return { status: 'connected', facebook: null, instagram: null }
      }

      if (pages.length === 1) {
        step = 'persistMetaPageConnection'
        const { facebook, instagram } = await persistMetaPageConnection(
          this.oauthRepo,
          this.tokenVault,
          userId,
          brandId,
          longLived.access_token,
          expiresAt,
          pages[0]!,
        )
        return { status: 'connected', facebook, instagram }
      }

      // Mais de uma Página administrada: sem perguntar, a conexão poderia ir parar numa
      // Página diferente da que o usuário pretendia (achado real em produção — ver
      // _local-edr-policy-053). Guarda o token e a lista de Páginas temporariamente no vault
      // e devolve pra o usuário escolher — mesmo padrão de HandleLinkedInPageCallbackUseCase.
      step = 'storePendingSelection'
      const pendingId = randomUUID()
      await this.tokenVault.store(
        `meta-page-pending-${pendingId}`,
        JSON.stringify({
          userId,
          brandId,
          user_access_token: longLived.access_token,
          expiresAt: expiresAt.toISOString(),
          pages,
          iat: Date.now(),
        }),
      )

      return { status: 'pending', pendingId, pages }
    } catch (err) {
      if (err instanceof Error) {
        err.message = `[step=${step}] ${err.message}`
      }
      throw err
    }
  }
}
