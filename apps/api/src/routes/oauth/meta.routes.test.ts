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

const { getUserPagesMock } = vi.hoisted(() => ({
  getUserPagesMock: vi.fn().mockResolvedValue([
    {
      id: 'page-1',
      name: 'Test Page',
      access_token: 'page-token',
      instagram_business_account: { id: 'ig-123' },
    },
  ]),
}))

vi.mock('../../lib/meta-client.js', () => ({
  buildMetaAuthUrl: vi
    .fn()
    .mockImplementation((state: string) => `https://www.facebook.com/dialog/oauth?state=${encodeURIComponent(state)}`),
  exchangeCodeForShortLivedToken: vi.fn().mockResolvedValue({
    access_token: 'short-token',
    token_type: 'bearer',
  }),
  exchangeShortForLongLived: vi.fn().mockResolvedValue({
    access_token: 'long-token',
    token_type: 'bearer',
    expires_in: 5184000,
  }),
  getUserPages: getUserPagesMock,
}))

describe('Meta OAuth routes', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    process.env['CSRF_SECRET'] = 'test-secret-64-chars-long-enough-for-hmac-sha256-signing'
    process.env['META_APP_ID'] = 'test-meta-app-id'
    process.env['META_REDIRECT_URI'] = 'http://localhost:3001/oauth/meta/callback'
    process.env['WEB_URL'] = 'http://localhost:3000'
    app = await buildApp()
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  describe('GET /oauth/meta/authorize', () => {
    it('returns Facebook auth URL for authenticated user', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/oauth/meta/authorize',
        headers: { authorization: 'Bearer valid-token' },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json<{ url: string }>()
      expect(body.url).toContain('facebook.com')
    })

    it('returns 401 without authorization header', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/oauth/meta/authorize',
      })

      expect(response.statusCode).toBe(401)
    })
  })

  describe('GET /oauth/meta/callback', () => {
    it('redirects with connected=facebook,instagram when both are linked', async () => {
      const state = generateState('user-test-123', 'user-test-123')
      const response = await app.inject({
        method: 'GET',
        url: `/oauth/meta/callback?code=meta-code&state=${encodeURIComponent(state)}`,
      })

      expect(response.statusCode).toBe(302)
      const location = response.headers['location'] as string
      expect(location).toContain('facebook')
      expect(location).toContain('instagram')
    })

    it('redirects with connected=facebook&metaNote=no-instagram when the page has no linked Instagram', async () => {
      getUserPagesMock.mockResolvedValueOnce([
        { id: 'page-1', name: 'Page Without IG', access_token: 'page-token' },
      ])
      const state = generateState('user-test-123', 'brand-456')

      const response = await app.inject({
        method: 'GET',
        url: `/oauth/meta/callback?code=meta-code&state=${encodeURIComponent(state)}`,
      })

      expect(response.statusCode).toBe(302)
      const location = response.headers['location'] as string
      expect(location).toContain('connected=facebook')
      // O Instagram não entra na lista connected= (só o Facebook conectou)…
      expect(location).not.toContain('connected=facebook,instagram')
      // …e o motivo é sinalizado à parte pra a tela avisar o usuário.
      expect(location).toContain('metaNote=no-instagram')
    })

    it('redirects to accounts with metaResult=no-pages when the user administers no Facebook Page', async () => {
      getUserPagesMock.mockResolvedValueOnce([])
      const state = generateState('user-test-123', 'brand-456')

      const response = await app.inject({
        method: 'GET',
        url: `/oauth/meta/callback?code=meta-code&state=${encodeURIComponent(state)}`,
      })

      expect(response.statusCode).toBe(302)
      const location = response.headers['location'] as string
      expect(location).toContain('/dashboard/accounts?metaResult=no-pages')
    })

    it('redirects with error=oauth_failed on invalid state', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/oauth/meta/callback?code=meta-code&state=bad.state',
      })

      expect(response.statusCode).toBe(302)
      expect(response.headers['location']).toContain('error=oauth_failed')
    })

    it('returns 400 when required params are missing', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/oauth/meta/callback?code=only-code',
      })

      expect(response.statusCode).toBe(400)
    })

    it('ignores an unsigned brandId query param and saves using the brandId embedded in state', async () => {
      const state = generateState('user-test-123', 'brand-456')
      const callsBefore = saveSpy.mock.calls.length

      const response = await app.inject({
        method: 'GET',
        url: `/oauth/meta/callback?code=meta-code&state=${encodeURIComponent(state)}&brandId=attacker-brand-999`,
      })

      expect(response.statusCode).toBe(302)
      const newCalls = saveSpy.mock.calls.slice(callsBefore) as Array<[{ brandId: string }]>
      expect(newCalls.length).toBeGreaterThan(0)
      for (const [connection] of newCalls) {
        expect(connection.brandId).toBe('brand-456')
      }
    })

    it('redirects with error=oauth_denied when the user denies permissions', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/oauth/meta/callback?error=access_denied&error_reason=user_denied',
      })

      expect(response.statusCode).toBe(302)
      const location = response.headers['location'] as string
      expect(location).toContain('error=oauth_denied')
      expect(location).toContain('detail=user_denied')
    })

    it('embeds the request Origin in state when allowed, and the callback redirects back to it', async () => {
      const authorizeResponse = await app.inject({
        method: 'GET',
        url: '/oauth/meta/authorize',
        headers: { authorization: 'Bearer valid-token', origin: 'http://localhost:3000' },
      })
      const state = new URL(
        authorizeResponse.json<{ url: string }>().url,
        'https://facebook.com',
      ).searchParams.get('state')

      const callbackResponse = await app.inject({
        method: 'GET',
        url: `/oauth/meta/callback?code=meta-code&state=${encodeURIComponent(state ?? '')}`,
      })

      expect(callbackResponse.statusCode).toBe(302)
      expect(callbackResponse.headers['location']).toContain('http://localhost:3000/dashboard?connected=')
    })

    it('recovers webOrigin from state even when the user denies permissions', async () => {
      const state = generateState('user-test-123', 'user-test-123', undefined, 'https://socialshelf.com.br')
      const response = await app.inject({
        method: 'GET',
        url: `/oauth/meta/callback?error=access_denied&error_reason=user_denied&state=${encodeURIComponent(state)}`,
      })

      expect(response.statusCode).toBe(302)
      expect(response.headers['location']).toBe(
        'https://socialshelf.com.br/dashboard?error=oauth_denied&detail=user_denied',
      )
    })

    it('redirects to /dashboard/accounts with metaPagePending when the user administers more than one page', async () => {
      getUserPagesMock.mockResolvedValueOnce([
        { id: 'page-1', name: 'Page One', access_token: 'token-1' },
        { id: 'page-2', name: 'Page Two', access_token: 'token-2' },
      ])

      const state = generateState('user-test-123', 'brand-456')
      const callsBefore = saveSpy.mock.calls.length

      const response = await app.inject({
        method: 'GET',
        url: `/oauth/meta/callback?code=meta-code&state=${encodeURIComponent(state)}`,
      })

      expect(response.statusCode).toBe(302)
      expect(response.headers['location']).toContain('/dashboard/accounts?metaPagePending=')
      expect(saveSpy.mock.calls.length).toBe(callsBefore)
    })
  })

  describe('GET /oauth/meta/pending/:pendingId', () => {
    it('returns the page list for the owning user', async () => {
      retrieveSpy.mockResolvedValueOnce(
        JSON.stringify({
          userId: 'user-test-123',
          brandId: 'brand-456',
          user_access_token: 'long-token',
          expiresAt: new Date(Date.now() + 5184000_000).toISOString(),
          pages: [{ id: 'page-1', name: 'Page One', access_token: 'token-1' }],
          iat: Date.now(),
        }),
      )

      const response = await app.inject({
        method: 'GET',
        url: '/oauth/meta/pending/pending-1',
        headers: { authorization: 'Bearer valid-token' },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json<{ pages: Array<{ id: string }> }>()
      expect(body.pages).toEqual([{ id: 'page-1', name: 'Page One', access_token: 'token-1' }])
    })

    it('returns 404 when the pending selection does not belong to the requesting user', async () => {
      retrieveSpy.mockResolvedValueOnce(
        JSON.stringify({
          userId: 'someone-else',
          brandId: 'brand-456',
          user_access_token: 'long-token',
          expiresAt: new Date(Date.now() + 5184000_000).toISOString(),
          pages: [{ id: 'page-1', name: 'Page One', access_token: 'token-1' }],
          iat: Date.now(),
        }),
      )

      const response = await app.inject({
        method: 'GET',
        url: '/oauth/meta/pending/pending-1',
        headers: { authorization: 'Bearer valid-token' },
      })

      expect(response.statusCode).toBe(404)
    })

    it('returns 401 without authorization header', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/oauth/meta/pending/pending-1',
      })

      expect(response.statusCode).toBe(401)
    })
  })

  describe('POST /oauth/meta/select', () => {
    it('persists the connection for a valid pageId', async () => {
      retrieveSpy.mockResolvedValueOnce(
        JSON.stringify({
          userId: 'user-test-123',
          brandId: 'brand-456',
          user_access_token: 'long-token',
          expiresAt: new Date(Date.now() + 5184000_000).toISOString(),
          pages: [
            {
              id: 'page-1',
              name: 'Page One',
              access_token: 'token-1',
              instagram_business_account: { id: 'ig-123', username: 'pageone' },
            },
          ],
          iat: Date.now(),
        }),
      )

      const response = await app.inject({
        method: 'POST',
        url: '/oauth/meta/select',
        headers: { authorization: 'Bearer valid-token' },
        payload: { pendingId: 'pending-1', pageId: 'page-1' },
      })

      expect(response.statusCode).toBe(200)
      expect(saveSpy).toHaveBeenCalled()
      expect(deleteSpy).toHaveBeenCalledWith('meta-page-pending-pending-1')
    })

    it('returns 400 for an invalid pageId', async () => {
      retrieveSpy.mockResolvedValueOnce(
        JSON.stringify({
          userId: 'user-test-123',
          brandId: 'brand-456',
          user_access_token: 'long-token',
          expiresAt: new Date(Date.now() + 5184000_000).toISOString(),
          pages: [{ id: 'page-1', name: 'Page One', access_token: 'token-1' }],
          iat: Date.now(),
        }),
      )

      const response = await app.inject({
        method: 'POST',
        url: '/oauth/meta/select',
        headers: { authorization: 'Bearer valid-token' },
        payload: { pendingId: 'pending-1', pageId: 'page-999' },
      })

      expect(response.statusCode).toBe(400)
    })

    it('returns 400 when the request body is missing required fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/oauth/meta/select',
        headers: { authorization: 'Bearer valid-token' },
        payload: { pendingId: 'pending-1' },
      })

      expect(response.statusCode).toBe(400)
    })
  })
})
