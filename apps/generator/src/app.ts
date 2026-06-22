import Fastify from 'fastify'
import helmet from '@fastify/helmet'
import multipart from '@fastify/multipart'
import { healthRoutes } from './routes/health.routes.js'
import { pautaRoutes } from './routes/pauta.routes.js'
import { generationRoutes } from './routes/generation.routes.js'
import { performanceInsightsRoutes } from './routes/performance-insights.routes.js'
import { performanceSuggestionsRoutes } from './routes/performance-suggestions.routes.js'
import { brandProfileRoutes } from './routes/brand-profile.routes.js'

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
  await app.register(pautaRoutes)
  await app.register(generationRoutes)
  await app.register(performanceInsightsRoutes)
  await app.register(performanceSuggestionsRoutes)
  await app.register(brandProfileRoutes)

  return app
}
