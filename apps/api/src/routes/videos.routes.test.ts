import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../app.js'
import type { FastifyInstance } from 'fastify'

vi.mock('../infrastructure/firebase-admin.js', () => ({
  db: {},
  adminAuth: { verifyIdToken: vi.fn().mockResolvedValue({ uid: 'user-test-123' }) },
}))

const originalFetch = global.fetch

function buildMultipartBody(fields: {
  fileName?: string
  mimeType?: string
  fileContent?: string
  durationSeconds?: string
  consent?: string
  omitFile?: boolean
}) {
  const boundary = '----socialshelfTestBoundary'
  const parts: string[] = []

  if (!fields.omitFile) {
    parts.push(
      `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="file"; filename="${fields.fileName ?? 'clip.mp4'}"\r\n` +
        `Content-Type: ${fields.mimeType ?? 'video/mp4'}\r\n\r\n` +
        `${fields.fileContent ?? 'fake-video-bytes'}\r\n`,
    )
  }

  if (fields.durationSeconds !== undefined) {
    parts.push(
      `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="durationSeconds"\r\n\r\n` +
        `${fields.durationSeconds}\r\n`,
    )
  }

  if (fields.consent !== undefined) {
    parts.push(
      `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="consent"\r\n\r\n` +
        `${fields.consent}\r\n`,
    )
  }

  parts.push(`--${boundary}--\r\n`)

  return {
    body: parts.join(''),
    contentType: `multipart/form-data; boundary=${boundary}`,
  }
}

describe('POST /videos/upload', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    process.env['GENERATOR_URL'] = 'http://localhost:3003'
    process.env['INTERNAL_SECRET'] = 'test-internal-secret'
    app = await buildApp()
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
    global.fetch = originalFetch
  })

  it('uploads a valid video with consent and duration in range', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ path: 'videos/user-test-123/brand-1/upload-1.mp4' }),
    }) as unknown as typeof fetch

    const { body, contentType } = buildMultipartBody({ durationSeconds: '10', consent: 'true' })

    const response = await app.inject({
      method: 'POST',
      url: '/videos/upload',
      headers: { authorization: 'Bearer valid-token', 'content-type': contentType },
      payload: body,
    })

    expect(response.statusCode).toBe(200)
    const responseBody = response.json<{ path: string; consentAcceptedAt: string }>()
    expect(responseBody.path).toBe('videos/user-test-123/brand-1/upload-1.mp4')
    expect(responseBody.consentAcceptedAt).toBeTruthy()
  })

  it('rejects when consent is not given', async () => {
    const { body, contentType } = buildMultipartBody({ durationSeconds: '10', consent: 'false' })

    const response = await app.inject({
      method: 'POST',
      url: '/videos/upload',
      headers: { authorization: 'Bearer valid-token', 'content-type': contentType },
      payload: body,
    })

    expect(response.statusCode).toBe(400)
  })

  it('rejects when duration is below the TikTok minimum (3s)', async () => {
    const { body, contentType } = buildMultipartBody({ durationSeconds: '1', consent: 'true' })

    const response = await app.inject({
      method: 'POST',
      url: '/videos/upload',
      headers: { authorization: 'Bearer valid-token', 'content-type': contentType },
      payload: body,
    })

    expect(response.statusCode).toBe(400)
  })

  it('rejects when duration exceeds the TikTok maximum (600s)', async () => {
    const { body, contentType } = buildMultipartBody({ durationSeconds: '601', consent: 'true' })

    const response = await app.inject({
      method: 'POST',
      url: '/videos/upload',
      headers: { authorization: 'Bearer valid-token', 'content-type': contentType },
      payload: body,
    })

    expect(response.statusCode).toBe(400)
  })

  it('rejects unsupported mime types', async () => {
    const { body, contentType } = buildMultipartBody({
      mimeType: 'image/png',
      durationSeconds: '10',
      consent: 'true',
    })

    const response = await app.inject({
      method: 'POST',
      url: '/videos/upload',
      headers: { authorization: 'Bearer valid-token', 'content-type': contentType },
      payload: body,
    })

    expect(response.statusCode).toBe(400)
  })

  it('rejects when no file is provided', async () => {
    const { body, contentType } = buildMultipartBody({ omitFile: true, durationSeconds: '10', consent: 'true' })

    const response = await app.inject({
      method: 'POST',
      url: '/videos/upload',
      headers: { authorization: 'Bearer valid-token', 'content-type': contentType },
      payload: body,
    })

    expect(response.statusCode).toBe(400)
  })

  it('returns 401 without authorization header', async () => {
    const { body, contentType } = buildMultipartBody({ durationSeconds: '10', consent: 'true' })

    const response = await app.inject({
      method: 'POST',
      url: '/videos/upload',
      headers: { 'content-type': contentType },
      payload: body,
    })

    expect(response.statusCode).toBe(401)
  })
})

describe('POST /videos/compose-slideshow', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    process.env['GENERATOR_URL'] = 'http://localhost:3003'
    process.env['INTERNAL_SECRET'] = 'test-internal-secret'
    app = await buildApp()
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
    global.fetch = originalFetch
  })

  it('returns 401 without authorization header', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/videos/compose-slideshow',
      payload: { requestId: 'req-1', imagePaths: ['a.png'] },
    })
    expect(response.statusCode).toBe(401)
  })

  it('returns 400 when imagePaths is missing', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/videos/compose-slideshow',
      headers: { authorization: 'Bearer valid-token' },
      payload: { requestId: 'req-1' },
    })
    expect(response.statusCode).toBe(400)
  })

  it('forwards to the generator and returns the composed video path', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ path: 'videos/user-test-123/brand-1/req-1.mp4', durationSeconds: 6 }),
    }) as unknown as typeof fetch

    const response = await app.inject({
      method: 'POST',
      url: '/videos/compose-slideshow',
      headers: { authorization: 'Bearer valid-token' },
      payload: { requestId: 'req-1', imagePaths: ['user-test-123/brand-1/img-0.png'] },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json<{ path: string; durationSeconds: number }>()
    expect(body.path).toBe('videos/user-test-123/brand-1/req-1.mp4')
    expect(body.durationSeconds).toBe(6)
  })

  it('returns 502 when the generator fails', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'boom' }) as unknown as typeof fetch

    const response = await app.inject({
      method: 'POST',
      url: '/videos/compose-slideshow',
      headers: { authorization: 'Bearer valid-token' },
      payload: { requestId: 'req-1', imagePaths: ['user-test-123/brand-1/img-0.png'] },
    })

    expect(response.statusCode).toBe(502)
  })
})

describe('GET /videos/signed-url', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    process.env['GENERATOR_URL'] = 'http://localhost:3003'
    process.env['INTERNAL_SECRET'] = 'test-internal-secret'
    app = await buildApp()
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
    global.fetch = originalFetch
  })

  it('returns 401 without authorization header', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/videos/signed-url?path=videos/user-test-123/brand-1/clip.mp4',
    })
    expect(response.statusCode).toBe(401)
  })

  it('returns 403 when the path does not belong to the requesting user', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/videos/signed-url?path=videos/someone-else/brand-1/clip.mp4',
      headers: { authorization: 'Bearer valid-token' },
    })
    expect(response.statusCode).toBe(403)
  })

  it('returns the signed url for a path owned by the requesting user', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ url: 'https://storage.googleapis.com/signed-video-url' }),
    }) as unknown as typeof fetch

    const response = await app.inject({
      method: 'GET',
      url: '/videos/signed-url?path=videos/user-test-123/brand-1/clip.mp4',
      headers: { authorization: 'Bearer valid-token' },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ url: 'https://storage.googleapis.com/signed-video-url' })
  })
})
