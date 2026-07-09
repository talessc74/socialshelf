import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../app.js'
import type { FastifyInstance } from 'fastify'

vi.mock('../infrastructure/firebase-admin.js', () => ({
  db: {},
  adminAuth: {},
}))

const mockUpload = vi.fn().mockResolvedValue('videos/user-1/brand-1/upload-123.mp4')
const mockGetSignedUrl = vi.fn().mockResolvedValue('https://storage.googleapis.com/signed-video-url')
const mockDelete = vi.fn().mockResolvedValue(undefined)
const mockListOlderThan = vi.fn().mockResolvedValue([])

vi.mock('../infrastructure/storage/GcsVideoStorage.js', () => ({
  GcsVideoStorage: vi.fn().mockImplementation(() => ({
    upload: mockUpload,
    getSignedUrl: mockGetSignedUrl,
    delete: mockDelete,
    listOlderThan: mockListOlderThan,
  })),
}))

const mockImageDownload = vi.fn().mockResolvedValue({ base64: Buffer.from('fake-image').toString('base64'), mimeType: 'image/png' })

vi.mock('../infrastructure/storage/GcsImageStorage.js', () => ({
  GcsImageStorage: vi.fn().mockImplementation(() => ({
    download: mockImageDownload,
  })),
}))

const mockComposeSlideshow = vi.fn().mockResolvedValue({ videoBuffer: Buffer.from('fake-video'), durationSeconds: 6 })

vi.mock('../infrastructure/video/FfmpegVideoComposer.js', () => ({
  FfmpegVideoComposer: vi.fn().mockImplementation(() => ({
    composeSlideshow: mockComposeSlideshow,
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

describe('POST /internal/videos-cleanup-tick', () => {
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

  it('returns 401 without internal secret', async () => {
    const response = await app.inject({ method: 'POST', url: '/internal/videos-cleanup-tick' })
    expect(response.statusCode).toBe(401)
  })

  it('deletes every path returned by listOlderThan and reports the count', async () => {
    mockListOlderThan.mockResolvedValueOnce([
      'videos/user-1/brand-1/old-1.mp4',
      'videos/user-1/brand-1/old-2.mp4',
    ])

    const response = await app.inject({
      method: 'POST',
      url: '/internal/videos-cleanup-tick',
      headers: { 'x-internal-secret': 'test-internal-secret' },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json<{ deletedCount: number; deleted: string[]; failed: unknown[] }>()
    expect(body.deletedCount).toBe(2)
    expect(body.deleted).toEqual(['videos/user-1/brand-1/old-1.mp4', 'videos/user-1/brand-1/old-2.mp4'])
    expect(body.failed).toEqual([])
    expect(mockDelete).toHaveBeenCalledWith('videos/user-1/brand-1/old-1.mp4')
    expect(mockDelete).toHaveBeenCalledWith('videos/user-1/brand-1/old-2.mp4')
  })

  it('reports per-file failures without aborting the rest', async () => {
    mockListOlderThan.mockResolvedValueOnce(['videos/user-1/brand-1/ok.mp4', 'videos/user-1/brand-1/bad.mp4'])
    mockDelete.mockImplementationOnce(() => Promise.resolve())
    mockDelete.mockImplementationOnce(() => Promise.reject(new Error('gcs unavailable')))

    const response = await app.inject({
      method: 'POST',
      url: '/internal/videos-cleanup-tick',
      headers: { 'x-internal-secret': 'test-internal-secret' },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json<{ deletedCount: number; failed: { path: string; error: string }[] }>()
    expect(body.deletedCount).toBe(1)
    expect(body.failed).toEqual([{ path: 'videos/user-1/brand-1/bad.mp4', error: 'gcs unavailable' }])
  })

  it('returns zero deletions when nothing is old enough', async () => {
    mockListOlderThan.mockResolvedValueOnce([])

    const response = await app.inject({
      method: 'POST',
      url: '/internal/videos-cleanup-tick',
      headers: { 'x-internal-secret': 'test-internal-secret' },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ deletedCount: 0, deleted: [], failed: [] })
  })
})

describe('POST /videos/compose-slideshow', () => {
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

  it('returns 401 without internal secret', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/videos/compose-slideshow',
      payload: { userId: 'user-1', brandId: 'brand-1', requestId: 'req-1', imagePaths: ['a.png'] },
    })
    expect(response.statusCode).toBe(401)
  })

  it('returns 400 when imagePaths is empty', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/videos/compose-slideshow',
      headers: { 'x-internal-secret': 'test-internal-secret' },
      payload: { userId: 'user-1', brandId: 'brand-1', requestId: 'req-1', imagePaths: [] },
    })
    expect(response.statusCode).toBe(400)
  })

  it('returns 400 when imagePaths has more than 10 entries', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/videos/compose-slideshow',
      headers: { 'x-internal-secret': 'test-internal-secret' },
      payload: {
        userId: 'user-1',
        brandId: 'brand-1',
        requestId: 'req-1',
        imagePaths: Array.from({ length: 11 }, (_, i) => `img-${i}.png`),
      },
    })
    expect(response.statusCode).toBe(400)
  })

  it('downloads each image, composes the slideshow, and returns the uploaded path', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/videos/compose-slideshow',
      headers: { 'x-internal-secret': 'test-internal-secret' },
      payload: {
        userId: 'user-1',
        brandId: 'brand-1',
        requestId: 'req-1',
        imagePaths: ['user-1/brand-1/img-0.png', 'user-1/brand-1/img-1.png'],
      },
    })

    expect(response.statusCode).toBe(200)
    expect(mockImageDownload).toHaveBeenCalledTimes(2)
    expect(mockComposeSlideshow).toHaveBeenCalledWith({
      slides: [
        { imageBuffer: expect.any(Buffer), durationSeconds: 3 },
        { imageBuffer: expect.any(Buffer), durationSeconds: 3 },
      ],
    })
    const body = response.json<{ path: string; durationSeconds: number }>()
    expect(body.path).toBe('videos/user-1/brand-1/upload-123.mp4')
    expect(body.durationSeconds).toBe(6)
  })

  it('returns 500 when composition fails', async () => {
    mockComposeSlideshow.mockRejectedValueOnce(new Error('ffmpeg exploded'))

    const response = await app.inject({
      method: 'POST',
      url: '/videos/compose-slideshow',
      headers: { 'x-internal-secret': 'test-internal-secret' },
      payload: {
        userId: 'user-1',
        brandId: 'brand-1',
        requestId: 'req-1',
        imagePaths: ['user-1/brand-1/img-0.png'],
      },
    })

    expect(response.statusCode).toBe(500)
  })
})
