import { Platform } from '@socialshelf/domain'
import type { OAuthConnection, OAuthRepository, TokenVaultPort } from '@socialshelf/domain'
import { fetchMetaPages, refreshInstagramLoginToken, refreshMetaUserToken } from '../lib/meta-refresh.js'

// Só Facebook/Instagram passam por aqui — X, TikTok e LinkedIn já se recuperam sozinhos num
// 401 (refresh_token separado do access_token). O Meta Graph API não tem essa separação: só dá
// pra trocar um token de usuário ainda VÁLIDO por um novo — depois de expirado, não tem volta,
// só reconexão manual (_local-adr-policy-016, emenda 2026-11-22). Por isso o refresh aqui
// precisa ser proativo, antes do prazo, não reativo a uma falha.
const REFRESH_WINDOW_DAYS = 10
const SIXTY_DAYS_IN_SECONDS = 60 * 24 * 60 * 60
const ONE_YEAR_IN_SECONDS = 365 * 24 * 60 * 60

function computeExpiresAt(expiresInSeconds: number | undefined): Date {
  const isPlausible =
    typeof expiresInSeconds === 'number' &&
    Number.isFinite(expiresInSeconds) &&
    expiresInSeconds > 0 &&
    expiresInSeconds <= ONE_YEAR_IN_SECONDS
  const seconds = isPlausible ? expiresInSeconds! : SIXTY_DAYS_IN_SECONDS
  const expiresAt = new Date(Date.now() + seconds * 1000)
  return Number.isNaN(expiresAt.getTime()) ? new Date(Date.now() + SIXTY_DAYS_IN_SECONDS * 1000) : expiresAt
}

interface FacebookLoginToken {
  auth_kind?: undefined
  user_access_token: string
  page_access_token: string
  page_id: string
  page_name?: string
  instagram_business_account_id?: string
  expires_at?: string
}

interface InstagramLoginToken {
  auth_kind: 'instagram_login'
  access_token: string
  instagram_user_id: string
  username?: string
  expires_at?: string
}

type StoredMetaToken = FacebookLoginToken | InstagramLoginToken

export interface RefreshMetaConnectionsResult {
  checked: number
  refreshed: number
  failed: Array<{ connectionId: string; platform: Platform; message: string }>
}

export class RefreshMetaConnectionsUseCase {
  constructor(
    private readonly oauthRepo: OAuthRepository,
    private readonly tokenVault: TokenVaultPort,
  ) {}

  async execute(): Promise<RefreshMetaConnectionsResult> {
    const connections = await this.oauthRepo.findAllByPlatforms([Platform.FACEBOOK, Platform.INSTAGRAM])
    const cutoff = new Date(Date.now() + REFRESH_WINDOW_DAYS * 24 * 60 * 60 * 1000)
    const expiring = connections.filter((c) => c.expiresAt !== null && c.expiresAt.getTime() <= cutoff.getTime())

    const failed: RefreshMetaConnectionsResult['failed'] = []
    let refreshed = 0

    for (const connection of expiring) {
      try {
        await this.refreshOne(connection)
        refreshed += 1
      } catch (err) {
        failed.push({
          connectionId: connection.id,
          platform: connection.platform,
          message: err instanceof Error ? err.message : String(err),
        })
      }
    }

    return { checked: expiring.length, refreshed, failed }
  }

  private async refreshOne(connection: OAuthConnection): Promise<void> {
    const raw = await this.tokenVault.retrieve(connection.tokenRef)
    const token: StoredMetaToken = JSON.parse(raw)

    if (token.auth_kind === 'instagram_login') {
      const refreshedToken = await refreshInstagramLoginToken(token.access_token)
      const expiresAt = computeExpiresAt(refreshedToken.expires_in)

      await this.tokenVault.store(
        connection.tokenRef,
        JSON.stringify({
          ...token,
          access_token: refreshedToken.access_token,
          expires_at: expiresAt.toISOString(),
        }),
      )
      await this.oauthRepo.save({ ...connection, expiresAt, updatedAt: new Date() })
      return
    }

    const refreshedUserToken = await refreshMetaUserToken(token.user_access_token)
    const expiresAt = computeExpiresAt(refreshedUserToken.expires_in)
    const pages = await fetchMetaPages(refreshedUserToken.access_token)
    const page = pages.find((p) => p.id === token.page_id)
    if (!page) {
      throw new Error(`Página ${token.page_id} não encontrada mais entre as Páginas administradas pelo usuário`)
    }

    await this.tokenVault.store(
      connection.tokenRef,
      JSON.stringify({
        ...token,
        user_access_token: refreshedUserToken.access_token,
        page_access_token: page.access_token,
        expires_at: expiresAt.toISOString(),
      }),
    )
    await this.oauthRepo.save({ ...connection, expiresAt, updatedAt: new Date() })
  }
}
