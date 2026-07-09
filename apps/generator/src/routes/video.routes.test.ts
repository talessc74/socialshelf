import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../app.js'
import type { FastifyInstance } from 'fastify'

vi.mock('../infrastructure/firebase-admin.js', () => ({
  db: {},
  adminAuth: {},
}))

const mockUpload = vi.fn().mockResolvedValue('videos/user-1/brand-1/upload-123.mp4')
const mockGetSignedUrl = vi.fn().mockResolvedValue('https://storage.googleapis.com/signed-video-url')

vi.mock('../infrastructure/storage/GcsVideoStorage.js', () => ({
  GcsVideoStorage: vi.fn().mockImplementation(() => ({
    upload: mockUpload,
    getSignedUrl: mockGetSignedUrl,
    delete: vi.fn(),
  })),
}))

describe('POST /videos/upload', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    process.env['INTERNAL_SECRET'] = 'test-internal-secret'
    app = await buildApp()
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
    delete process.env['INTERNAL_SECRET']
  })

  it('returns 200 with the storage path', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/videos/upload',
      headers: { 'x-internal-secret': 'test-internal-secret' },
      payload: {
        userId: 'user-1',
        brandId: 'brand-1',
        base64: Buffer.from('fake-video-bytes').toString('base64'),
        mimeType: 'video/mp4',
      },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json<{ path: string }>()
    expect(body.path).toBe('videos/user-1/brand-1/upload-123.mp4')
  })

  it('rejects unsupported mime types', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/videos/upload',
      headers: { 'x-internal-secret': 'test-internal-secret' },
      payload: {
        userId: 'user-1',
        brandId: 'brand-1',
        base64: Buffer.from('fake').toString('base64'),
        mimeType: 'image/png',
      },
    })

    expect(response.statusCode).toBe(400)
  })

  it('returns 401 without internal secret', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/videos/upload',
      payload: {
        userId: 'user-1',
        brandId: 'brand-1',
        base64: Buffer.from('fake-video-bytes').toString('base64'),
        mimeType: 'video/mp4',
      },
    })

    expect(response.statusCode).toBe(401)
  })
})

describe('GET /videos/signed-url', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    process.env['INTERNAL_SECRET'] = 'test-internal-secret'
    app = await buildApp()
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
    delete process.env['INTERNAL_SECRET']
  })

  it('returns 200 with a signed url', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/videos/signed-url?path=videos/user-1/brand-1/upload-123.mp4',
      headers: { 'x-internal-secret': 'test-internal-secret' },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json<{ url: string }>()
    expect(body.url).toBe('https://storage.googleapis.com/signed-video-url')
  })

  it('returns 400 when path is missing', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/videos/signed-url',
      headers: { 'x-internal-secret': 'test-internal-secret' },
    })

    expect(response.statusCode).toBe(400)
  })

  it('returns 401 without internal secret', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/videos/signed-url?path=videos/user-1/brand-1/upload-123.mp4',
    })

    expect(response.statusCode).toBe(401)
  })
})
