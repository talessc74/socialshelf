import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../app.js'
import type { FastifyInstance } from 'fastify'

vi.mock('../infrastructure/firebase-admin.js', () => ({
  db: {},
  adminAuth: {},
}))

const mockAnswer = vi.fn().mockResolvedValue('Vá em Central de Contas e clique em Reconectar.')

vi.mock('../infrastructure/vertexai/GeminiSelfieAssistant.js', () => ({
  GeminiSelfieAssistant: vi.fn().mockImplementation(() => ({
    answer: mockAnswer,
  })),
}))

describe('POST /selfie/ask', () => {
  let app: FastifyInstance

  const validPayload = {
    userId: 'user-1',
    brandId: 'brand-1',
    question: 'Como conecto o Instagram?',
  }

  beforeAll(async () => {
    process.env['INTERNAL_SECRET'] = 'test-internal-secret'
    app = await buildApp()
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
    delete process.env['INTERNAL_SECRET']
  })

  it('returns 200 with the AI-generated answer', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/selfie/ask',
      payload: validPayload,
      headers: { 'x-internal-secret': 'test-internal-secret' },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ answer: 'Vá em Central de Contas e clique em Reconectar.' })
  })

  it('passes the question, history, accountStatus and ids through to the assistant', async () => {
    const accountStatus = [{ platform: 'instagram', connected: true, accountLabel: '@marca', connectionLikelyExpired: true }]
    const history = [{ role: 'user', text: 'Oi' }]

    await app.inject({
      method: 'POST',
      url: '/selfie/ask',
      payload: { ...validPayload, history, accountStatus },
      headers: { 'x-internal-secret': 'test-internal-secret' },
    })

    expect(mockAnswer).toHaveBeenCalledWith('Como conecto o Instagram?', history, accountStatus, 'user-1', 'brand-1')
  })

  it('returns 400 when question is empty', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/selfie/ask',
      payload: { ...validPayload, question: '' },
      headers: { 'x-internal-secret': 'test-internal-secret' },
    })

    expect(response.statusCode).toBe(400)
  })

  it('returns 401 when INTERNAL_SECRET header is missing', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/selfie/ask',
      payload: validPayload,
    })

    expect(response.statusCode).toBe(401)
  })

  it('returns 500 when the assistant throws', async () => {
    mockAnswer.mockRejectedValueOnce(new Error('gemini exploded'))

    const response = await app.inject({
      method: 'POST',
      url: '/selfie/ask',
      payload: validPayload,
      headers: { 'x-internal-secret': 'test-internal-secret' },
    })

    expect(response.statusCode).toBe(500)
  })
})
