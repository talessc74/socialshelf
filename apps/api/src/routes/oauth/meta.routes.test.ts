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

const { saveSpy } = vi.hoisted(() => ({ saveSpy: vi.fn().mockResolvedValue(undefined) }))

vi.mock('../../infrastructure/firestore/FirestoreOAuthRepository.js', () => ({
  FirestoreOAuthRepository: vi.fn().mockImplementation(() => ({
    save: saveSpy,
  })),
}))

vi.mock('../../infrastructure/firestore/FirestoreTokenVault.js', () => ({
  FirestoreTokenVault: vi.fn().mockImplementation(() => ({
    store: vi.fn().mockResolvedValue(undefined),
  })),
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
  getUserPages: vi.fn().mockResolvedValue([
    {
      id: 'page-1',
      name: 'Test Page',
      access_token: 'page-token',
      instagram_business_account: { id: 'ig-123' },
    },
  ]),
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
  })
})
