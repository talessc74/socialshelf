export interface LinkedInTokenResponse {
  access_token: string
  expires_in: number
  refresh_token?: string
  scope: string
}

export function buildLinkedInAuthUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env['LINKEDIN_CLIENT_ID'] ?? '',
    redirect_uri: process.env['LINKEDIN_REDIRECT_URI'] ?? '',
    scope: 'profile w_member_social',
    state,
  })
  return `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`
}

export async function exchangeCodeForToken(
  code: string,
  redirectUri: string,
): Promise<LinkedInTokenResponse> {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: process.env['LINKEDIN_CLIENT_ID'] ?? '',
    client_secret: process.env['LINKEDIN_CLIENT_SECRET'] ?? '',
  })

  const response = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`LinkedIn token exchange failed: ${error}`)
  }

  return response.json() as Promise<LinkedInTokenResponse>
}
