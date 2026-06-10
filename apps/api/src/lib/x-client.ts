import { randomBytes, createHash } from 'crypto'

const X_API_BASE = 'https://api.twitter.com'
const X_AUTH_BASE = 'https://twitter.com'

export interface XTokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
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

export function buildXAuthUrl(state: string, codeChallenge: string): string {
  const clientId = process.env['X_CLIENT_ID'] ?? ''
  const redirectUri = process.env['X_REDIRECT_URI'] ?? ''

  const scopes = [
    'tweet.read',
    'tweet.write',
    'users.read',
    'offline.access',
  ]

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: scopes.join(' '),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  })

  return `${X_AUTH_BASE}/i/oauth2/authorize?${params.toString()}`
}

export async function exchangeCodeForXToken(
  code: string,
  codeVerifier: string,
): Promise<XTokenResponse> {
  const clientId = process.env['X_CLIENT_ID'] ?? ''
  const clientSecret = process.env['X_CLIENT_SECRET'] ?? ''
  const redirectUri = process.env['X_REDIRECT_URI'] ?? ''

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
  })

  const response = await fetch(`${X_API_BASE}/2/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: body.toString(),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`X token exchange failed: ${response.status} ${text}`)
  }

  return response.json() as Promise<XTokenResponse>
}
