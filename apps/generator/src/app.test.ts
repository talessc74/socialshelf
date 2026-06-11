import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from './app.js'
import type { FastifyInstance } from 'fastify'

describe('buildApp', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = await buildApp()
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
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
})
