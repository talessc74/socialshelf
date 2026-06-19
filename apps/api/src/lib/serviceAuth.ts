import { GoogleAuth } from 'google-auth-library'

const auth = new GoogleAuth()

/**
 * publisher-service e generator-service rodam com --no-allow-unauthenticated
 * no Cloud Run (ADR-005, ADR-022) — chamadas internas precisam de um ID token
 * assinado pelo Google, além do INTERNAL_SECRET validado pelo serviço receptor.
 * Em desenvolvimento local (sem metadata server do GCP) o token é dispensado.
 */
export async function fetchInternal(url: string, init: RequestInit): Promise<Response> {
  const headers = new Headers(init.headers)

  if (!new URL(url).hostname.includes('localhost')) {
    const audience = new URL(url).origin
    const client = await auth.getIdTokenClient(audience)
    const idToken = await client.idTokenProvider.fetchIdToken(audience)
    headers.set('Authorization', `Bearer ${idToken}`)
  }

  return fetch(url, { ...init, headers })
}
