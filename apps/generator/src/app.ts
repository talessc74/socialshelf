import Fastify from 'fastify'
import helmet from '@fastify/helmet'
import multipart from '@fastify/multipart'
import { healthRoutes } from './routes/health.routes.js'

export async function buildApp() {
  const app = Fastify({
    logger: { level: process.env['LOG_LEVEL'] ?? 'info' },
  })

  await app.register(helmet)
  await app.register(multipart, {
    limits: {
      fileSize: 20 * 1024 * 1024, // 20MB per file
      files: 10,
    },
  })
  await app.register(healthRoutes)

  return app
}
