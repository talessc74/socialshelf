// Cliente do "Login do Instagram" (Instagram API with Instagram Login) — o caminho de conexão
// que NÃO exige Facebook: nem conta, nem Página (_local-edr-policy-057). A conta do Instagram
// ainda precisa ser profissional (Business/Creator) — exigência da Meta em qualquer caminho.
// Endpoints distintos do Facebook Login (meta-client.ts): autorização em www.instagram.com,
// troca de code em api.instagram.com, e Graph em graph.instagram.com.

const IG_AUTH_URL = 'https://www.instagram.com/oauth/authorize'
const IG_TOKEN_URL = 'https://api.instagram.com/oauth/access_token'
const IG_GRAPH_URL = 'https://graph.instagram.com'

export interface InstagramShortLivedToken {
  access_token: string
  user_id: number | string
  permissions?: string[]
}

export interface InstagramLongLivedToken {
  access_token: string
  token_type: string
  expires_in?: number
}

export interface InstagramProfile {
  user_id: number | string
  username: string
}

export function buildInstagramAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env['INSTAGRAM_APP_ID'] ?? '',
    redirect_uri: process.env['INSTAGRAM_REDIRECT_URI'] ?? '',
    // Nomes vigentes desde dez/2024 (os antigos business_basic/business_content_publish foram
    // renomeados pela Meta com o prefixo instagram_).
    scope: ['instagram_business_basic', 'instagram_business_content_publish'].join(','),
    response_type: 'code',
    state,
  })
  return `${IG_AUTH_URL}?${params.toString()}`
}

export async function exchangeCodeForInstagramToken(
  code: string,
  redirectUri: string,
): Promise<InstagramShortLivedToken> {
  const body = new URLSearchParams({
    client_id: process.env['INSTAGRAM_APP_ID'] ?? '',
    client_secret: process.env['INSTAGRAM_APP_SECRET'] ?? '',
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
    code,
  })

  const response = await fetch(IG_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Instagram token exchange failed: ${error}`)
  }

  return response.json() as Promise<InstagramShortLivedToken>
}

export async function exchangeForLongLivedInstagramToken(
  shortLivedToken: string,
): Promise<InstagramLongLivedToken> {
  const params = new URLSearchParams({
    grant_type: 'ig_exchange_token',
    client_secret: process.env['INSTAGRAM_APP_SECRET'] ?? '',
    access_token: shortLivedToken,
  })

  const response = await fetch(`${IG_GRAPH_URL}/access_token?${params.toString()}`)

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Instagram long-lived token exchange failed: ${error}`)
  }

  return response.json() as Promise<InstagramLongLivedToken>
}

export async function getInstagramProfile(accessToken: string): Promise<InstagramProfile> {
  const params = new URLSearchParams({
    fields: 'user_id,username',
    access_token: accessToken,
  })

  const response = await fetch(`${IG_GRAPH_URL}/v21.0/me?${params.toString()}`)

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to fetch Instagram profile: ${error}`)
  }

  return response.json() as Promise<InstagramProfile>
}
