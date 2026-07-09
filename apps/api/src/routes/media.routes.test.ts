import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest'
import { buildApp } from '../app.js'
import type { FastifyInstance } from 'fastify'

vi.mock('../infrastructure/firebase-admin.js', () => ({
  db: {},
  adminAuth: { verifyIdToken: vi.fn().mockResolvedValue({ uid: 'user-test-123' }) },
}))

const originalFetch = global.fetch

describe('GET /media/tiktok-video', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    process.env['GENERATOR_URL'] = 'http://localhost:3003'
    process.env['INTERNAL_SECRET'] = 'test-internal-secret'
    app = await buildApp()
    await app.ready()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  afterAll(async () => {
    await app.close()
  })

  it('returns 400 when path is missing', async () => {
    const response = await app.inject({ method: 'GET', url: '/media/tiktok-video' })
    expect(response.statusCode).toBe(400)
  })

  it('returns 400 when path does not start with videos/', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/media/tiktok-video?path=generated/some-image.png',
    })
    expect(response.statusCode).toBe(400)
  })

  it('returns 404 when the generator cannot produce a signed url', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, text: async () => 'not found' }) as unknown as typeof fetch

    const response = await app.inject({
      method: 'GET',
      url: '/media/tiktok-video?path=videos/user-1/brand-1/clip.mp4',
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
      url: '/media/tiktok-video?path=videos/user-1/brand-1/clip.mp4',
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toBe('video/mp4')
  })
})
