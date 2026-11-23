// Extraído de XPublisher para ser reaproveitado também por XAnalyticsReader
// (_local-adr-policy-016, emenda 2026-11-22) — mesma lógica, sem mudança de comportamento.
export interface XRefreshedToken {
  access_token: string
  refresh_token?: string
  expires_in: number
  scope: string
}

export async function refreshXToken(refreshToken: string): Promise<XRefreshedToken> {
  const clientId = process.env['X_CLIENT_ID'] ?? ''
  const clientSecret = process.env['X_CLIENT_SECRET'] ?? ''
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  })

  const response = await fetch('https://api.twitter.com/2/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: body.toString(),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`X token refresh failed: ${response.status} ${text}`)
  }

  return response.json() as Promise<XRefreshedToken>
}
