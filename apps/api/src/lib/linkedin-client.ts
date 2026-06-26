export interface LinkedInTokenResponse {
  access_token: string
  expires_in: number
  refresh_token?: string
  scope: string
}

export interface LinkedInOrganization {
  urn: string
  name: string
}

export function buildLinkedInAuthUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env['LINKEDIN_CLIENT_ID'] ?? '',
    redirect_uri: process.env['LINKEDIN_REDIRECT_URI'] ?? '',
    scope: 'openid profile email w_member_social r_organization_admin w_organization_social',
    state,
  })
  return `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`
}

// Requer o produto "Community Management API" habilitado no app LinkedIn para retornar
// resultados; sem ele, a chamada responde 200 com lista vazia (não é um erro a propagar).
export async function listAdministeredOrganizations(accessToken: string): Promise<LinkedInOrganization[]> {
  const params = new URLSearchParams({
    q: 'roleAssignee',
    role: 'ADMINISTRATOR',
    projection: '(elements*(organization~(id,localizedName)))',
  })

  const response = await fetch(`https://api.linkedin.com/v2/organizationAcls?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    return []
  }

  const data = (await response.json()) as {
    elements?: Array<{ 'organization~'?: { id: number; localizedName: string } }>
  }

  return (data.elements ?? [])
    .filter((el) => el['organization~'] != null)
    .map((el) => ({
      urn: `urn:li:organization:${el['organization~']!.id}`,
      name: el['organization~']!.localizedName,
    }))
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
