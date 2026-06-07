import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../app.js'
import type { FastifyInstance } from 'fastify'

vi.mock('../infrastructure/firebase-admin.js', () => ({
  db: {},
  adminAuth: {
    verifyIdToken: vi.fn().mockResolvedValue({ uid: 'user-test' }),
  },
}))

vi.mock('../infrastructure/firestore/FirestoreOAuthRepository.js', () => ({
  FirestoreOAuthRepository: vi.fn().mockImplementation(() => ({})),
}))

vi.mock('../infrastructure/secret-manager/SecretManagerTokenVault.js', () => ({
  SecretManagerTokenVault: vi.fn().mockImplementation(() => ({})),
}))

describe('GET /health', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = await buildApp()
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  it('returns status ok with service name', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    })

    expect(response.statusCode).toBe(200)
    const body = response.json<{ status: string; service: string; timestamp: string }>()
    expect(body.status).toBe('ok')
    expect(body.service).toBe('api-service')
    expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })
})
