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

vi.mock('../../infrastructure/secret-manager/SecretManagerTokenVault.js', () => ({
  SecretManagerTokenVault: vi.fn().mockImplementation(() => ({
    store: vi.fn().mockResolvedValue(undefined),
  })),
}))

vi.mock('../../lib/x-client.js', () => ({
  generatePkce: vi.fn().mockReturnValue({
    codeVerifier: 'test-verifier-32-bytes-base64url',
    codeChallenge: 'test-challenge-s256',
  }),
  buildXAuthUrl: vi.fn().mockReturnValue('https://twitter.com/i/oauth2/authorize?mocked=1'),
  exchangeCodeForXToken: vi.fn().mockResolvedValue({
    access_token: 'x-access-token',
    refresh_token: 'x-refresh-token',
    expires_in: 7200,
    scope: 'tweet.read tweet.write users.read offline.access',
    token_type: 'bearer',
  }),
}))

describe('X OAuth routes', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    process.env['CSRF_SECRET'] = 'test-secret-64-chars-long-enough-for-hmac-sha256-signing'
    process.env['X_CLIENT_ID'] = 'test-x-client-id'
    process.env['X_CLIENT_SECRET'] = 'test-x-client-secret'
    process.env['X_REDIRECT_URI'] = 'http://localhost:3001/oauth/x/callback'
    process.env['WEB_URL'] = 'http://localhost:3000'
    app = await buildApp()
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  describe('GET /oauth/x/authorize', () => {
    it('returns Twitter auth URL for authenticated user', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/oauth/x/authorize',
        headers: { authorization: 'Bearer valid-token' },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json<{ url: string }>()
      expect(body.url).toContain('twitter.com')
    })

    it('sets pkce_verifier and oauth_state cookies', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/oauth/x/authorize',
        headers: { authorization: 'Bearer valid-token' },
      })

      const setCookieHeader = response.headers['set-cookie'] as string | string[]
      const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader]
      expect(cookies.some((c) => c.startsWith('pkce_verifier='))).toBe(true)
      expect(cookies.some((c) => c.startsWith('oauth_state='))).toBe(true)
    })

    it('returns 401 without authorization header', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/oauth/x/authorize',
      })

      expect(response.statusCode).toBe(401)
    })
  })

  describe('GET /oauth/x/callback', () => {
    it('redirects with connected=twitter on valid state and verifier', async () => {
      const state = generateState('user-test-123')

      const response = await app.inject({
        method: 'GET',
        url: `/oauth/x/callback?code=x-code&state=${encodeURIComponent(state)}&brandId=user-test-123`,
        cookies: {
          pkce_verifier: 'test-verifier-32-bytes-base64url',
          oauth_state: state,
        },
      })

      expect(response.statusCode).toBe(302)
      expect(response.headers['location']).toContain('connected=twitter')
    })

    it('redirects with error=oauth_failed when cookies are missing', async () => {
      const state = generateState('user-test-123')

      const response = await app.inject({
        method: 'GET',
        url: `/oauth/x/callback?code=x-code&state=${encodeURIComponent(state)}&brandId=user-test-123`,
      })

      expect(response.statusCode).toBe(302)
      expect(response.headers['location']).toContain('error=oauth_failed')
    })

    it('redirects with error=oauth_failed when state does not match cookie', async () => {
      const state = generateState('user-test-123')

      const response = await app.inject({
        method: 'GET',
        url: `/oauth/x/callback?code=x-code&state=${encodeURIComponent(state)}&brandId=user-test-123`,
        cookies: {
          pkce_verifier: 'test-verifier-32-bytes-base64url',
          oauth_state: 'different-state',
        },
      })

      expect(response.statusCode).toBe(302)
      expect(response.headers['location']).toContain('error=oauth_failed')
    })

    it('returns 400 when required params are missing', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/oauth/x/callback?code=only-code',
      })

      expect(response.statusCode).toBe(400)
    })
  })
})
