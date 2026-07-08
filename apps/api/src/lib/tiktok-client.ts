import { randomBytes, createHash } from 'crypto'

const TIKTOK_AUTH_BASE = 'https://www.tiktok.com'
const TIKTOK_API_BASE = 'https://open.tiktokapis.com'

export interface TikTokTokenResponse {
  access_token: string
  expires_in: number
  open_id: string
  refresh_expires_in: number
  refresh_token: string
  scope: string
  token_type: string
}

export interface PkceChallenge {
  codeVerifier: string
  codeChallenge: string
}

export function generatePkce(): PkceChallenge {
  const codeVerifier = randomBytes(32).toString('base64url')
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url')
  return { codeVerifier, codeChallenge }
}

export function buildTikTokAuthUrl(state: string, codeChallenge: string): string {
  const clientKey = process.env['TIKTOK_CLIENT_KEY'] ?? ''
  const redirectUri = process.env['TIKTOK_REDIRECT_URI'] ?? ''

  // Escopo mínimo necessário: login (identidade) + publicação direta de vídeo.
  // video.upload (rascunho para o usuário editar no app do TikTok) não é solicitado —
  // ADR-035 decide por Direct Post, não pelo fluxo de rascunho.
  const scopes = ['user.info.basic', 'video.publish']

  // TikTok exige escopos separados por vírgula na URL de autorização — diferente
  // de X/LinkedIn/Meta, que usam espaço. Confirmado contra o Developer Portal.
  const params = new URLSearchParams({
    client_key: clientKey,
    response_type: 'code',
    scope: scopes.join(','),
    redirect_uri: redirectUri,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  })

  return `${TIKTOK_AUTH_BASE}/v2/auth/authorize/?${params.toString()}`
}

export async function exchangeCodeForTikTokToken(
  code: string,
  codeVerifier: string,
): Promise<TikTokTokenResponse> {
  const clientKey = process.env['TIKTOK_CLIENT_KEY'] ?? ''
  const clientSecret = process.env['TIKTOK_CLIENT_SECRET'] ?? ''
  const redirectUri = process.env['TIKTOK_REDIRECT_URI'] ?? ''

  // TikTok espera client_key/client_secret no corpo do POST, não em header
  // Basic auth (diferente de X).
  const body = new URLSearchParams({
    client_key: clientKey,
    client_secret: clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
  })

  const response = await fetch(`${TIKTOK_API_BASE}/v2/oauth/token/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`TikTok token exchange failed: ${response.status} ${text}`)
  }

  return response.json() as Promise<TikTokTokenResponse>
}
