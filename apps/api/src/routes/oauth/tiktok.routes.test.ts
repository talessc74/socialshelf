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

vi.mock('../../lib/tiktok-client.js', () => ({
  generatePkce: vi.fn().mockReturnValue({
    codeVerifier: 'test-verifier-32-bytes-base64url',
    codeChallenge: 'test-challenge-s256',
  }),
  buildTikTokAuthUrl: vi
    .fn()
    .mockImplementation((state: string) => `https://www.tiktok.com/v2/auth/authorize/?state=${encodeURIComponent(state)}`),
  exchangeCodeForTikTokToken: vi.fn().mockResolvedValue({
    access_token: 'tiktok-access-token',
    refresh_token: 'tiktok-refresh-token',
    expires_in: 86400,
    refresh_expires_in: 31536000,
    open_id: 'tiktok-open-id',
    scope: 'user.info.basic,video.publish',
    token_type: 'Bearer',
  }),
}))

describe('TikTok OAuth routes', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    process.env['CSRF_SECRET'] = 'test-secret-64-chars-long-enough-for-hmac-sha256-signing'
    process.env['TIKTOK_CLIENT_KEY'] = 'test-tiktok-client-key'
    process.env['TIKTOK_CLIENT_SECRET'] = 'test-tiktok-client-secret'
    process.env['TIKTOK_REDIRECT_URI'] = 'http://localhost:3001/oauth/tiktok/callback'
    process.env['WEB_URL'] = 'http://localhost:3000'
    app = await buildApp()
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  describe('GET /oauth/tiktok/authorize', () => {
    it('returns TikTok auth URL for authenticated user', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/oauth/tiktok/authorize',
        headers: { authorization: 'Bearer valid-token' },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json<{ url: string }>()
      expect(body.url).toContain('tiktok.com')
    })

    it('does not set pkce_verifier or oauth_state cookies', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/oauth/tiktok/authorize',
        headers: { authorization: 'Bearer valid-token' },
      })

      const setCookieHeader = response.headers['set-cookie']
      expect(setCookieHeader).toBeUndefined()
    })

    it('returns 401 without authorization header', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/oauth/tiktok/authorize',
      })

      expect(response.statusCode).toBe(401)
    })
  })

  describe('GET /oauth/tiktok/callback', () => {
    it('redirects with connected=tiktok on valid state with embedded codeVerifier', async () => {
      const state = generateState('user-test-123', 'user-test-123', 'test-verifier-32-bytes-base64url')

      const response = await app.inject({
        method: 'GET',
        url: `/oauth/tiktok/callback?code=tt-code&state=${encodeURIComponent(state)}`,
      })

      expect(response.statusCode).toBe(302)
      expect(response.headers['location']).toContain('connected=tiktok')
    })

    it('ignores an unsigned brandId query param and saves using the brandId embedded in state', async () => {
      const state = generateState('user-test-123', 'brand-456', 'test-verifier-32-bytes-base64url')
      const callsBefore = saveSpy.mock.calls.length

      const response = await app.inject({
        method: 'GET',
        url: `/oauth/tiktok/callback?code=tt-code&state=${encodeURIComponent(state)}&brandId=attacker-brand-999`,
      })

      expect(response.statusCode).toBe(302)
      const newCalls = saveSpy.mock.calls.slice(callsBefore) as Array<[{ brandId: string }]>
      expect(newCalls.length).toBeGreaterThan(0)
      for (const [connection] of newCalls) {
        expect(connection.brandId).toBe('brand-456')
      }
    })

    it('embeds the request Origin in state when allowed, and the callback redirects back to it', async () => {
      const authorizeResponse = await app.inject({
        method: 'GET',
        url: '/oauth/tiktok/authorize',
        headers: { authorization: 'Bearer valid-token', origin: 'http://localhost:3000' },
      })
      const state = new URL(
        authorizeResponse.json<{ url: string }>().url,
        'https://tiktok.com',
      ).searchParams.get('state')

      const callbackResponse = await app.inject({
        method: 'GET',
        url: `/oauth/tiktok/callback?code=tt-code&state=${encodeURIComponent(state ?? '')}`,
      })

      expect(callbackResponse.statusCode).toBe(302)
      expect(callbackResponse.headers['location']).toBe(
        'http://localhost:3000/dashboard?connected=tiktok',
      )
    })

    it('ignores an untrusted Origin header, falling back to the default WEB_URL', async () => {
      const authorizeResponse = await app.inject({
        method: 'GET',
        url: '/oauth/tiktok/authorize',
        headers: { authorization: 'Bearer valid-token', origin: 'https://attacker.example' },
      })
      const state = new URL(
        authorizeResponse.json<{ url: string }>().url,
        'https://tiktok.com',
      ).searchParams.get('state')

      const callbackResponse = await app.inject({
        method: 'GET',
        url: `/oauth/tiktok/callback?code=tt-code&state=${encodeURIComponent(state ?? '')}`,
      })

      expect(callbackResponse.statusCode).toBe(302)
      expect(callbackResponse.headers['location']).toBe(
        'http://localhost:3000/dashboard?connected=tiktok',
      )
    })

    it('redirects with error=oauth_failed when state has no embedded codeVerifier', async () => {
      const state = generateState('user-test-123', 'user-test-123')

      const response = await app.inject({
        method: 'GET',
        url: `/oauth/tiktok/callback?code=tt-code&state=${encodeURIComponent(state)}`,
      })

      expect(response.statusCode).toBe(302)
      expect(response.headers['location']).toContain('error=oauth_failed')
    })

    it('redirects with error=oauth_failed on invalid state', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/oauth/tiktok/callback?code=tt-code&state=invalid.tampered',
      })

      expect(response.statusCode).toBe(302)
      expect(response.headers['location']).toContain('error=oauth_failed')
    })

    it('returns 400 when required params are missing', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/oauth/tiktok/callback?code=only-code',
      })

      expect(response.statusCode).toBe(400)
    })
  })
})
