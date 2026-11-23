// Refresh proativo de tokens Meta (_local-adr-policy-016, emenda 2026-11-22) — exige o token
// ainda válido (Meta não aceita trocar um token já expirado), diferente do padrão reativo de
// X/TikTok/LinkedIn. Por isso vive num job agendado (RefreshMetaConnectionsUseCase), não num
// retry em cima de 401. Duplica em miniatura os clientes de apps/api/src/lib/{meta,instagram}
// -client.ts — mesmo padrão de duplicação de infra por serviço já usado em FirestoreTokenVault
// e FirestoreOAuthRepository.

const META_API_VERSION = 'v21.0'
const META_GRAPH_URL = `https://graph.facebook.com/${META_API_VERSION}`
const IG_GRAPH_URL = 'https://graph.instagram.com'

export interface MetaRefreshedToken {
  access_token: string
  expires_in: number
}

export interface MetaPage {
  id: string
  name: string
  access_token: string
  instagram_business_account?: { id: string; username?: string }
}

// Re-troca um token de usuário de longa duração ainda válido por um novo de 60 dias
// (grant_type: fb_exchange_token aceita tanto o código curto quanto um token de longa duração
// ainda não expirado — mesma chamada usada na troca inicial em exchangeShortForLongLived).
export async function refreshMetaUserToken(currentToken: string): Promise<MetaRefreshedToken> {
  const params = new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: process.env['META_APP_ID'] ?? '',
    client_secret: process.env['META_APP_SECRET'] ?? '',
    fb_exchange_token: currentToken,
  })

  const response = await fetch(`${META_GRAPH_URL}/oauth/access_token?${params.toString()}`)

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Meta user token refresh failed: ${response.status} ${error}`)
  }

  return response.json() as Promise<MetaRefreshedToken>
}

// Re-busca as Páginas administradas com o token de usuário já renovado — o page_access_token
// derivado do token antigo não é automaticamente atualizado pela Meta.
export async function fetchMetaPages(userAccessToken: string): Promise<MetaPage[]> {
  const fields = 'id,name,access_token,instagram_business_account{id,username}'
  const response = await fetch(
    `${META_GRAPH_URL}/me/accounts?fields=${fields}&access_token=${userAccessToken}`,
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to refresh Meta pages: ${response.status} ${error}`)
  }

  const data = (await response.json()) as { data: MetaPage[] }
  return data.data
}

// Caminho do "Login do Instagram" direto (auth_kind: 'instagram_login') — grant distinto do
// de Páginas/Facebook: ig_refresh_token não exige client_secret, mas também só aceita um token
// ainda válido (mesma restrição do fb_exchange_token acima).
export async function refreshInstagramLoginToken(currentToken: string): Promise<MetaRefreshedToken> {
  const params = new URLSearchParams({
    grant_type: 'ig_refresh_token',
    access_token: currentToken,
  })

  const response = await fetch(`${IG_GRAPH_URL}/refresh_access_token?${params.toString()}`)

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Instagram login token refresh failed: ${response.status} ${error}`)
  }

  return response.json() as Promise<MetaRefreshedToken>
}
