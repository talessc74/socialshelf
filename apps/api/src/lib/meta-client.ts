const META_API_VERSION = 'v21.0'
const META_GRAPH_URL = `https://graph.facebook.com/${META_API_VERSION}`

export interface MetaShortLivedToken {
  access_token: string
  token_type: string
}

export interface MetaLongLivedToken {
  access_token: string
  token_type: string
  expires_in: number
}

export interface MetaPage {
  id: string
  name: string
  access_token: string
  instagram_business_account?: { id: string }
}

export function buildMetaAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env['META_APP_ID'] ?? '',
    redirect_uri: process.env['META_REDIRECT_URI'] ?? '',
    scope: [
      'pages_show_list',
      'pages_manage_posts',
      'pages_read_engagement',
      'business_management',
      'instagram_basic',
      'instagram_content_publish',
    ].join(','),
    response_type: 'code',
    state,
  })
  return `https://www.facebook.com/dialog/oauth?${params.toString()}`
}

export async function exchangeCodeForShortLivedToken(
  code: string,
  redirectUri: string,
): Promise<MetaShortLivedToken> {
  const params = new URLSearchParams({
    client_id: process.env['META_APP_ID'] ?? '',
    client_secret: process.env['META_APP_SECRET'] ?? '',
    redirect_uri: redirectUri,
    code,
  })

  const response = await fetch(
    `${META_GRAPH_URL}/oauth/access_token?${params.toString()}`,
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Meta short-lived token exchange failed: ${error}`)
  }

  return response.json() as Promise<MetaShortLivedToken>
}

export async function exchangeShortForLongLived(
  shortLivedToken: string,
): Promise<MetaLongLivedToken> {
  const params = new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: process.env['META_APP_ID'] ?? '',
    client_secret: process.env['META_APP_SECRET'] ?? '',
    fb_exchange_token: shortLivedToken,
  })

  const response = await fetch(
    `${META_GRAPH_URL}/oauth/access_token?${params.toString()}`,
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Meta long-lived token exchange failed: ${error}`)
  }

  return response.json() as Promise<MetaLongLivedToken>
}

export async function getUserPages(userAccessToken: string): Promise<MetaPage[]> {
  const fields = 'id,name,access_token,instagram_business_account'
  const response = await fetch(
    `${META_GRAPH_URL}/me/accounts?fields=${fields}&access_token=${userAccessToken}`,
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to fetch Meta pages: ${error}`)
  }

  const data = (await response.json()) as { data: MetaPage[] }
  return data.data
}
