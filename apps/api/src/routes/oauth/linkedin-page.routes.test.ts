import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../app.js'
import { generateState } from '../../lib/csrf.js'
import type { FastifyInstance } from 'fastify'

vi.mock('../../infrastructure/firebase-admin.js', () => ({
  db: {},
  adminAuth: {
    verifyIdToken: vi.fn().mockResolvedValue({ uid: 'user-test-123' }),
  },
}))

const { saveSpy, storeSpy, retrieveSpy, deleteSpy } = vi.hoisted(() => ({
  saveSpy: vi.fn().mockResolvedValue(undefined),
  storeSpy: vi.fn().mockResolvedValue(undefined),
  retrieveSpy: vi.fn(),
  deleteSpy: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../infrastructure/firestore/FirestoreOAuthRepository.js', () => ({
  FirestoreOAuthRepository: vi.fn().mockImplementation(() => ({
    save: saveSpy,
  })),
}))

vi.mock('../../infrastructure/firestore/FirestoreTokenVault.js', () => ({
  FirestoreTokenVault: vi.fn().mockImplementation(() => ({
    store: storeSpy,
    retrieve: retrieveSpy,
    delete: deleteSpy,
  })),
}))

vi.mock('../../lib/linkedin-page-client.js', () => ({
  buildLinkedInPageAuthUrl: vi
    .fn()
    .mockImplementation((state: string) => `https://www.linkedin.com/oauth/v2/authorization?state=${encodeURIComponent(state)}`),
  exchangeCodeForPageToken: vi.fn().mockResolvedValue({
    access_token: 'page-access-token',
    expires_in: 5183944,
    scope: 'r_organization_admin w_organization_social',
  }),
  listAdministeredOrganizations: vi.fn().mockResolvedValue([
    { urn: 'urn:li:organization:111', name: 'Acme' },
    { urn: 'urn:li:organization:222', name: 'Acme Labs' },
  ]),
}))

describe('LinkedIn Page OAuth routes', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    process.env['CSRF_SECRET'] = 'test-secret-64-chars-long-enough-for-hmac-sha256-signing'
    process.env['LINKEDIN_PAGE_CLIENT_ID'] = 'test-page-client-id'
    process.env['LINKEDIN_PAGE_REDIRECT_URI'] = 'http://localhost:3001/oauth/linkedin-page/callback'
    process.env['LINKEDIN_CLIENT_ID'] = 'test-client-id'
    process.env['LINKEDIN_REDIRECT_URI'] = 'http://localhost:3001/oauth/linkedin/callback'
    process.env['WEB_URL'] = 'http://localhost:3000'
    app = await buildApp()
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  describe('GET /oauth/linkedin-page/authorize', () => {
    it('returns auth URL for authenticated user', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/oauth/linkedin-page/authorize',
        headers: { authorization: 'Bearer valid-firebase-token' },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json<{ url: string }>()
      expect(body.url).toContain('linkedin.com')
    })

    it('returns 401 without authorization header', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/oauth/linkedin-page/authorize',
      })

      expect(response.statusCode).toBe(401)
    })
  })

  describe('GET /oauth/linkedin-page/callback', () => {
    it('redirects with linkedinPagePending when multiple organizations are administered', async () => {
      const state = generateState('user-test-123', 'brand-456')
      const response = await app.inject({
        method: 'GET',
        url: `/oauth/linkedin-page/callback?code=valid-code&state=${encodeURIComponent(state)}`,
      })

      expect(response.statusCode).toBe(302)
      expect(response.headers['location']).toContain('linkedinPagePending=')
      expect(saveSpy).not.toHaveBeenCalled()
    })

    it('embeds the request Origin in state when allowed, and the callback redirects back to it', async () => {
      const authorizeResponse = await app.inject({
        method: 'GET',
        url: '/oauth/linkedin-page/authorize',
        headers: { authorization: 'Bearer valid-firebase-token', origin: 'http://localhost:3000' },
      })
      const state = new URL(
        authorizeResponse.json<{ url: string }>().url,
        'https://linkedin.com',
      ).searchParams.get('state')

      const callbackResponse = await app.inject({
        method: 'GET',
        url: `/oauth/linkedin-page/callback?code=valid-code&state=${encodeURIComponent(state ?? '')}`,
      })

      expect(callbackResponse.statusCode).toBe(302)
      expect(callbackResponse.headers['location']).toContain('http://localhost:3000/dashboard/accounts?')
    })

    it('recovers webOrigin from state even when the user denies permission', async () => {
      const state = generateState('user-test-123', 'brand-456', undefined, 'https://socialshelf.com.br')
      const response = await app.inject({
        method: 'GET',
        url: `/oauth/linkedin-page/callback?error=user_cancelled_authorize&state=${encodeURIComponent(state)}`,
      })

      expect(response.statusCode).toBe(302)
      expect(response.headers['location']).toBe(
        'https://socialshelf.com.br/dashboard/accounts?error=oauth_failed',
      )
    })

    it('redirects to dashboard with error=oauth_failed on invalid state', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/oauth/linkedin-page/callback?code=valid-code&state=invalid.tampered',
      })

      expect(response.statusCode).toBe(302)
      expect(response.headers['location']).toContain('error=')
    })

    it('returns 400 when required params are missing', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/oauth/linkedin-page/callback?code=only-code',
      })

      expect(response.statusCode).toBe(400)
    })
  })

  describe('GET /oauth/linkedin-page/pending/:pendingId', () => {
    it('returns the organization list for the owning user', async () => {
      retrieveSpy.mockResolvedValue(
        JSON.stringify({
          userId: 'user-test-123',
          organizations: [{ urn: 'urn:li:organization:111', name: 'Acme' }],
          iat: Date.now(),
        }),
      )

      const response = await app.inject({
        method: 'GET',
        url: '/oauth/linkedin-page/pending/pending-1',
        headers: { authorization: 'Bearer valid-firebase-token' },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json<{ organizations: Array<{ urn: string }> }>()
      expect(body.organizations).toEqual([{ urn: 'urn:li:organization:111', name: 'Acme' }])
    })
  })

  describe('POST /oauth/linkedin-page/select', () => {
    it('persists the connection for a valid organizationUrn', async () => {
      retrieveSpy.mockResolvedValue(
        JSON.stringify({
          userId: 'user-test-123',
          brandId: 'brand-456',
          access_token: 'page-access-token',
          refresh_token: null,
          expires_in: 5183944,
          scope: 'r_organization_admin w_organization_social',
          organizations: [{ urn: 'urn:li:organization:111', name: 'Acme' }],
          iat: Date.now(),
        }),
      )

      const response = await app.inject({
        method: 'POST',
        url: '/oauth/linkedin-page/select',
        headers: { authorization: 'Bearer valid-firebase-token' },
        payload: { pendingId: 'pending-1', organizationUrn: 'urn:li:organization:111' },
      })

      expect(response.statusCode).toBe(200)
      expect(saveSpy).toHaveBeenCalled()
      expect(deleteSpy).toHaveBeenCalledWith('linkedin-page-pending-pending-1')
    })

    it('returns 400 for an invalid organizationUrn', async () => {
      retrieveSpy.mockResolvedValue(
        JSON.stringify({
          userId: 'user-test-123',
          brandId: 'brand-456',
          access_token: 'page-access-token',
          refresh_token: null,
          expires_in: 5183944,
          scope: 'r_organization_admin w_organization_social',
          organizations: [{ urn: 'urn:li:organization:111', name: 'Acme' }],
          iat: Date.now(),
        }),
      )

      const response = await app.inject({
        method: 'POST',
        url: '/oauth/linkedin-page/select',
        headers: { authorization: 'Bearer valid-firebase-token' },
        payload: { pendingId: 'pending-1', organizationUrn: 'urn:li:organization:999' },
      })

      expect(response.statusCode).toBe(400)
    })
  })
})
