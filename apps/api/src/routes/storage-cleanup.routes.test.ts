import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { buildApp } from '../app.js'
import type { FastifyInstance } from 'fastify'

vi.mock('../infrastructure/firebase-admin.js', () => ({
  db: {},
  adminAuth: { verifyIdToken: vi.fn().mockResolvedValue({ uid: 'user-test-123' }) },
}))

describe('POST /internal/storage-cleanup-tick', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    process.env['GENERATOR_URL'] = 'http://localhost:3003'
    process.env['INTERNAL_SECRET'] = 'test-internal-secret'
    app = await buildApp()
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  it('rejects a request without the internal secret header', async () => {
    const response = await app.inject({ method: 'POST', url: '/internal/storage-cleanup-tick' })

    expect(response.statusCode).toBe(401)
  })

  it('rejects a request with the wrong internal secret header', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/internal/storage-cleanup-tick',
      headers: { 'x-internal-secret': 'wrong-secret' },
    })

    expect(response.statusCode).toBe(401)
  })
})
