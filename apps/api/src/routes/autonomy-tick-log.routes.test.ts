import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import { buildApp } from '../app.js'
import type { FastifyInstance } from 'fastify'

vi.mock('../infrastructure/firebase-admin.js', () => ({
  db: {},
  adminAuth: { verifyIdToken: vi.fn().mockResolvedValue({ uid: 'user-test-123' }) },
}))

const findRecentByBrand = vi.fn().mockResolvedValue([])

vi.mock('../infrastructure/firestore/FirestoreAutonomyTickLogRepository.js', () => ({
  FirestoreAutonomyTickLogRepository: vi.fn().mockImplementation(() => ({
    save: vi.fn().mockResolvedValue(undefined),
    findRecentByBrand,
  })),
}))

describe('GET /autonomy-tick-log', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    process.env['CSRF_SECRET'] = 'test-secret-64-chars-long-enough-for-hmac-sha256-signing'
    process.env['WEB_URL'] = 'http://localhost:3000'
    process.env['PUBLISHER_URL'] = 'http://localhost:3002'
    app = await buildApp()
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    findRecentByBrand.mockReset().mockResolvedValue([])
  })

  it('returns an empty list when the brand has no tick history yet', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/autonomy-tick-log',
      headers: { authorization: 'Bearer valid-token' },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ entries: [] })
  })

  it('returns the most recent entries for the authenticated brand', async () => {
    findRecentByBrand.mockResolvedValue([
      {
        id: 'entry-1',
        userId: 'user-test-123',
        brandId: 'user-test-123',
        action: 'published',
        topicHeadline: 'Cliente relata resultado real',
        error: null,
        createdAt: new Date('2026-07-11T15:00:00.000Z'),
      },
    ])

    const response = await app.inject({
      method: 'GET',
      url: '/autonomy-tick-log',
      headers: { authorization: 'Bearer valid-token' },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json<{ entries: Array<{ action: string }> }>()
    expect(body.entries).toHaveLength(1)
    expect(body.entries[0]?.action).toBe('published')
    expect(findRecentByBrand).toHaveBeenCalledWith('user-test-123', 'user-test-123', 20)
  })

  it('returns 401 without auth header', async () => {
    const response = await app.inject({ method: 'GET', url: '/autonomy-tick-log' })
    expect(response.statusCode).toBe(401)
  })
})
