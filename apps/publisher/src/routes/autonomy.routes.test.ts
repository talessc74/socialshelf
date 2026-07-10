import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../app.js'
import type { FastifyInstance } from 'fastify'

vi.mock('../infrastructure/firebase-admin.js', () => ({
  db: {},
  adminAuth: {},
}))

// AutonomyTickUseCase.test.ts já cobre a lógica por marca em detalhe — aqui só se testa a
// conexão HTTP (guarda de auth, formato de resposta). Sem marcas elegíveis, o tick não toca
// nenhum outro repositório/publisher, então nada mais precisa de mock (mesmo espírito de
// /internal/scheduler-tick, que também não tem teste de rota dedicado).
const mockFindEligibleBrands = vi.fn().mockResolvedValue([])

vi.mock('../infrastructure/firestore/FirestoreAutonomyBrandDiscovery.js', () => ({
  FirestoreAutonomyBrandDiscovery: vi.fn().mockImplementation(() => ({
    findEligibleBrands: mockFindEligibleBrands,
  })),
}))

describe('POST /internal/autonomy-tick', () => {
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

  it('returns 200 with an empty result list when there are no eligible brands', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/internal/autonomy-tick',
      headers: { 'x-internal-secret': 'test-internal-secret' },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ results: [] })
    expect(mockFindEligibleBrands).toHaveBeenCalledTimes(1)
  })

  it('returns 401 without the internal secret', async () => {
    const response = await app.inject({ method: 'POST', url: '/internal/autonomy-tick' })
    expect(response.statusCode).toBe(401)
  })
})
