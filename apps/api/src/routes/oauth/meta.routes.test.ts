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

vi.mock('../../infrastructure/firestore/FirestoreOAuthRepository.js', () => ({
  FirestoreOAuthRepository: vi.fn().mockImplementation(() => ({
    save: vi.fn().mockResolvedValue(undefined),
  })),
}))

vi.mock('../../infrastructure/firestore/FirestoreTokenVault.js', () => ({
  FirestoreTokenVault: vi.fn().mockImplementation(() => ({
    store: vi.fn().mockResolvedValue(undefined),
  })),
}))

vi.mock('../../lib/meta-client.js', () => ({
  buildMetaAuthUrl: vi.fn().mockReturnValue('https://www.facebook.com/dialog/oauth?mocked=1'),
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
      const state = generateState('user-test-123')
      const response = await app.inject({
        method: 'GET',
        url: `/oauth/meta/callback?code=meta-code&state=${encodeURIComponent(state)}&brandId=user-test-123`,
      })

      expect(response.statusCode).toBe(302)
      const location = response.headers['location'] as string
      expect(location).toContain('facebook')
      expect(location).toContain('instagram')
    })

    it('redirects with error=oauth_failed on invalid state', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/oauth/meta/callback?code=meta-code&state=bad.state&brandId=user-test-123',
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
  })
})
