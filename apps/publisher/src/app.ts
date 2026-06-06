import Fastify from 'fastify'
import helmet from '@fastify/helmet'
import { healthRoutes } from './routes/health.routes.js'

export async function buildApp() {
  const app = Fastify({
    logger: { level: process.env['LOG_LEVEL'] ?? 'info' },
  })

  await app.register(helmet)
  await app.register(healthRoutes)

  return app
}
