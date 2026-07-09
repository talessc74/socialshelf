import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest'
import { buildApp } from '../app.js'
import type { FastifyInstance } from 'fastify'

vi.mock('../infrastructure/firebase-admin.js', () => ({
  db: {},
  adminAuth: { verifyIdToken: vi.fn().mockResolvedValue({ uid: 'user-test-123' }) },
}))

const originalFetch = global.fetch
const VALID_PATH = 'videos/user-1/brand-1/clip.mp4'

describe('GET /media/tiktok-video', () => {
  let app: FastifyInstance
  let validToken: string

  beforeAll(async () => {
    process.env['GENERATOR_URL'] = 'http://localhost:3003'
    process.env['INTERNAL_SECRET'] = 'test-internal-secret'
    process.env['CSRF_SECRET'] = 'test-secret-64-chars-long-enough-for-hmac-sha256-signing'
    app = await buildApp()
    await app.ready()

    // signMediaPath lives in apps/publisher (a different service); reproduce it locally
    // here with the same CSRF_SECRET-based HMAC scheme instead of a cross-service import.
    const { createHmac } = await import('crypto')
    const sign = (path: string): string => {
      const exp = Date.now() + 2 * 60 * 60 * 1000
      const payload = Buffer.from(JSON.stringify({ path, exp })).toString('base64url')
      const sig = createHmac('sha256', process.env['CSRF_SECRET']!).update(payload).digest('base64url')
      return `${payload}.${sig}`
    }
    validToken = sign(VALID_PATH)
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  afterAll(async () => {
    await app.close()
  })

  it('returns 400 when path is missing', async () => {
    const response = await app.inject({ method: 'GET', url: `/media/tiktok-video?token=${validToken}` })
    expect(response.statusCode).toBe(400)
  })

  it('returns 400 when token is missing', async () => {
    const response = await app.inject({ method: 'GET', url: `/media/tiktok-video?path=${VALID_PATH}` })
    expect(response.statusCode).toBe(400)
  })

  it('returns 400 when path does not start with videos/', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/media/tiktok-video?path=generated/some-image.png&token=${validToken}`,
    })
    expect(response.statusCode).toBe(400)
  })

  it('returns 401 when token is invalid', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/media/tiktok-video?path=${VALID_PATH}&token=not-a-real-token`,
    })
    expect(response.statusCode).toBe(401)
  })

  it('returns 401 when token was signed for a different path', async () => {
    const { createHmac } = await import('crypto')
    const exp = Date.now() + 2 * 60 * 60 * 1000
    const payload = Buffer.from(JSON.stringify({ path: 'videos/other/path.mp4', exp })).toString('base64url')
    const sig = createHmac('sha256', process.env['CSRF_SECRET']!).update(payload).digest('base64url')
    const mismatchedToken = `${payload}.${sig}`

    const response = await app.inject({
      method: 'GET',
      url: `/media/tiktok-video?path=${VALID_PATH}&token=${mismatchedToken}`,
    })
    expect(response.statusCode).toBe(401)
  })

  it('returns 401 when token is expired', async () => {
    const { createHmac } = await import('crypto')
    const exp = Date.now() - 1000
    const payload = Buffer.from(JSON.stringify({ path: VALID_PATH, exp })).toString('base64url')
    const sig = createHmac('sha256', process.env['CSRF_SECRET']!).update(payload).digest('base64url')
    const expiredToken = `${payload}.${sig}`

    const response = await app.inject({
      method: 'GET',
      url: `/media/tiktok-video?path=${VALID_PATH}&token=${expiredToken}`,
    })
    expect(response.statusCode).toBe(401)
  })

  it('returns 404 when the generator cannot produce a signed url', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, text: async () => 'not found' }) as unknown as typeof fetch

    const response = await app.inject({
      method: 'GET',
      url: `/media/tiktok-video?path=${VALID_PATH}&token=${validToken}`,
    })

    expect(response.statusCode).toBe(404)
  })

  it('streams the video bytes with the right content type when everything succeeds', async () => {
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/videos/signed-url')) {
        return {
          ok: true,
          json: async () => ({ url: 'https://storage.googleapis.com/signed-video-url' }),
        }
      }
      return {
        ok: true,
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('fake-video-bytes'))
            controller.close()
          },
        }),
        headers: new Headers({ 'content-type': 'video/mp4', 'content-length': '16' }),
      }
    }) as unknown as typeof fetch

    const response = await app.inject({
      method: 'GET',
      url: `/media/tiktok-video?path=${VALID_PATH}&token=${validToken}`,
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toBe('video/mp4')
  })
})
