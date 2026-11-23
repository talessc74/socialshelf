// Refresh reativo (401 → troca → re-tenta), mesmo padrão de x-refresh.ts — o refresh_token do
// LinkedIn (90 dias de validade, access_token de 60 dias) já era gravado no vault desde a
// conexão inicial (HandleLinkedInCallbackUseCase), mas nunca usado. _local-adr-policy-016,
// emenda 2026-11-22.
export interface LinkedInRefreshedToken {
  access_token: string
  refresh_token?: string
  expires_in: number
  scope: string
}

export async function refreshLinkedInToken(refreshToken: string): Promise<LinkedInRefreshedToken> {
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: process.env['LINKEDIN_CLIENT_ID'] ?? '',
    client_secret: process.env['LINKEDIN_CLIENT_SECRET'] ?? '',
  })

  const response = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`LinkedIn token refresh failed: ${response.status} ${text}`)
  }

  return response.json() as Promise<LinkedInRefreshedToken>
}
