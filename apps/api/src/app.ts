import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import multipart from '@fastify/multipart'
import { healthRoutes } from './routes/health.routes.js'
import { linkedinOAuthRoutes } from './routes/oauth/linkedin.routes.js'
import { metaOAuthRoutes } from './routes/oauth/meta.routes.js'
import { xOAuthRoutes } from './routes/oauth/x.routes.js'
import { postsRoutes } from './routes/posts.routes.js'
import { brandProfileRoutes } from './routes/brand-profile.routes.js'
import { audienceSignalRoutes } from './routes/audience-signal.routes.js'
import { postsPerformanceRoutes } from './routes/posts-performance.routes.js'
import { performanceInsightsRoutes } from './routes/performance-insights.routes.js'
import { performanceSuggestionsRoutes } from './routes/performance-suggestions.routes.js'
import { pautaRoutes } from './routes/pauta.routes.js'
import { generationRoutes } from './routes/generation.routes.js'
import { registerAuthMiddleware } from './middleware/auth.middleware.js'

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: process.env['LOG_LEVEL'] ?? 'info',
    },
  })

  await app.register(helmet)
  await app.register(cors, {
    origin: process.env['WEB_URL'] ?? 'http://localhost:3000',
    credentials: true,
  })
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  })
  await app.register(multipart, {
    limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  })

  await registerAuthMiddleware(app)

  await app.register(healthRoutes)
  await app.register(linkedinOAuthRoutes)
  await app.register(metaOAuthRoutes)
  await app.register(xOAuthRoutes)
  await app.register(postsRoutes)
  await app.register(brandProfileRoutes)
  await app.register(audienceSignalRoutes)
  await app.register(postsPerformanceRoutes)
  await app.register(performanceInsightsRoutes)
  await app.register(performanceSuggestionsRoutes)
  await app.register(pautaRoutes)
  await app.register(generationRoutes)

  return app
}
