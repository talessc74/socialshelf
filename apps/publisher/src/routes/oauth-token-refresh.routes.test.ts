import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../app.js'
import type { FastifyInstance } from 'fastify'

vi.mock('../infrastructure/firebase-admin.js', () => ({
  db: {},
  adminAuth: {},
}))

const mockFindAllByPlatforms = vi.fn().mockResolvedValue([])

vi.mock('../infrastructure/firestore/FirestoreOAuthRepository.js', () => ({
  FirestoreOAuthRepository: vi.fn().mockImplementation(() => ({
    findAllByPlatforms: mockFindAllByPlatforms,
  })),
}))

describe('POST /internal/oauth-token-refresh-tick', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    process.env['INTERNAL_SECRET'] = 'test-internal-secret'
    process.env['GENERATOR_URL'] = 'http://localhost:3002'
    app = await buildApp()
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
    delete process.env['INTERNAL_SECRET']
    delete process.env['GENERATOR_URL']
  })

  it('returns 200 with an empty summary when there are no Meta connections', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/internal/oauth-token-refresh-tick',
      headers: { 'x-internal-secret': 'test-internal-secret' },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ checked: 0, refreshed: 0, failed: [] })
    expect(mockFindAllByPlatforms).toHaveBeenCalledTimes(1)
  })

  it('returns 401 without the internal secret', async () => {
    const response = await app.inject({ method: 'POST', url: '/internal/oauth-token-refresh-tick' })
    expect(response.statusCode).toBe(401)
  })
})
