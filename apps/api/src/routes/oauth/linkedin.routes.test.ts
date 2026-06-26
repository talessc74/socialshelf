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

vi.mock('../../lib/linkedin-client.js', () => ({
  buildLinkedInAuthUrl: vi.fn().mockReturnValue('https://www.linkedin.com/oauth/v2/authorization?mocked=1'),
  exchangeCodeForToken: vi.fn().mockResolvedValue({
    access_token: 'access-token',
    expires_in: 5183944,
    scope: 'openid profile email w_member_social',
  }),
  listAdministeredOrganizations: vi.fn().mockResolvedValue([]),
}))

describe('LinkedIn OAuth routes', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    process.env['CSRF_SECRET'] = 'test-secret-64-chars-long-enough-for-hmac-sha256-signing'
    process.env['LINKEDIN_CLIENT_ID'] = 'test-client-id'
    process.env['LINKEDIN_REDIRECT_URI'] = 'http://localhost:3001/oauth/linkedin/callback'
    process.env['WEB_URL'] = 'http://localhost:3000'
    app = await buildApp()
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  describe('GET /oauth/linkedin/authorize', () => {
    it('returns auth URL for authenticated user', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/oauth/linkedin/authorize',
        headers: { authorization: 'Bearer valid-firebase-token' },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json<{ url: string }>()
      expect(body.url).toContain('linkedin.com')
    })

    it('returns 401 without authorization header', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/oauth/linkedin/authorize',
      })

      expect(response.statusCode).toBe(401)
    })

    it('returns 401 with malformed authorization header', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/oauth/linkedin/authorize',
        headers: { authorization: 'NotBearer token' },
      })

      expect(response.statusCode).toBe(401)
    })
  })

  describe('GET /oauth/linkedin/callback', () => {
    it('redirects to dashboard with connected=linkedin on success', async () => {
      const state = generateState('user-test-123', 'user-test-123')
      const response = await app.inject({
        method: 'GET',
        url: `/oauth/linkedin/callback?code=valid-code&state=${encodeURIComponent(state)}`,
      })

      expect(response.statusCode).toBe(302)
      expect(response.headers['location']).toContain('connected=linkedin')
    })

    it('ignores an unsigned brandId query param and saves using the brandId embedded in state', async () => {
      const state = generateState('user-test-123', 'brand-456')
      const callsBefore = saveSpy.mock.calls.length

      const response = await app.inject({
        method: 'GET',
        url: `/oauth/linkedin/callback?code=valid-code&state=${encodeURIComponent(state)}&brandId=attacker-brand-999`,
      })

      expect(response.statusCode).toBe(302)
      const newCalls = saveSpy.mock.calls.slice(callsBefore) as Array<[{ brandId: string }]>
      expect(newCalls.length).toBeGreaterThan(0)
      for (const [connection] of newCalls) {
        expect(connection.brandId).toBe('brand-456')
      }
    })

    it('redirects to dashboard with error=oauth_failed on invalid state', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/oauth/linkedin/callback?code=valid-code&state=invalid.tampered',
      })

      expect(response.statusCode).toBe(302)
      expect(response.headers['location']).toContain('error=oauth_failed')
    })

    it('returns 400 when required params are missing', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/oauth/linkedin/callback?code=only-code',
      })

      expect(response.statusCode).toBe(400)
    })
  })
})
