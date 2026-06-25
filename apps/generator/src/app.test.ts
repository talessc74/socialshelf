import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { buildApp } from './app.js'
import type { FastifyInstance } from 'fastify'

vi.mock('./infrastructure/firebase-admin.js', () => ({
  db: {},
  adminAuth: {},
}))

vi.mock('./infrastructure/firestore/FirestoreBrandProfileRepository.js', () => ({
  FirestoreBrandProfileRepository: vi.fn().mockImplementation(() => ({
    save: vi.fn(),
    findLatestByBrand: vi.fn(),
    findByBrandAndVersion: vi.fn(),
  })),
}))

vi.mock('./infrastructure/firestore/FirestoreAudienceSignalRepository.js', () => ({
  FirestoreAudienceSignalRepository: vi.fn().mockImplementation(() => ({
    save: vi.fn(),
    findLatestByBrandAndPlatform: vi.fn(),
  })),
}))

vi.mock('./infrastructure/firestore/FirestoreTopicSuggestionRepository.js', () => ({
  FirestoreTopicSuggestionRepository: vi.fn().mockImplementation(() => ({
    save: vi.fn(),
    findLatestByBrand: vi.fn(),
  })),
}))

vi.mock('./infrastructure/news/GoogleNewsRssReader.js', () => ({
  GoogleNewsRssReader: vi.fn().mockImplementation(() => ({
    fetchNews: vi.fn(),
  })),
}))

describe('buildApp', () => {
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

  it('starts without error', () => {
    expect(app).toBeDefined()
  })

  it('returns 404 for unknown routes', async () => {
    const response = await app.inject({ method: 'GET', url: '/nonexistent' })
    expect(response.statusCode).toBe(404)
  })

  it('includes security headers from helmet', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' })
    expect(response.headers['x-content-type-options']).toBeDefined()
  })

  it('builds successfully with custom LOG_LEVEL', async () => {
    process.env['LOG_LEVEL'] = 'warn'
    const warnApp = await buildApp()
    await warnApp.ready()
    expect(warnApp).toBeDefined()
    await warnApp.close()
    delete process.env['LOG_LEVEL']
  })

  it('accepts a JSON body larger than Fastify\'s 1MB default (gallery photos sent as base64)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/images/upload',
      headers: { 'x-internal-secret': 'test-internal-secret' },
      payload: {
        userId: 'user-1',
        brandId: 'user-1',
        base64: 'a'.repeat(2 * 1024 * 1024), // 2MB — would 413 under Fastify's default bodyLimit
        // mimeType omitted on purpose: a 413 happens before schema validation, a 400 after
      },
    })
    expect(response.statusCode).toBe(400)
  })
})
