import Fastify from 'fastify'
import cors from '@fastify/cors'
import { getAllowedWebOrigins } from './lib/webOrigin.js'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import multipart from '@fastify/multipart'
import { healthRoutes } from './routes/health.routes.js'
import { linkedinOAuthRoutes } from './routes/oauth/linkedin.routes.js'
import { linkedinPageOAuthRoutes } from './routes/oauth/linkedin-page.routes.js'
import { metaOAuthRoutes } from './routes/oauth/meta.routes.js'
import { instagramOAuthRoutes } from './routes/oauth/instagram.routes.js'
import { xOAuthRoutes } from './routes/oauth/x.routes.js'
import { tiktokOAuthRoutes } from './routes/oauth/tiktok.routes.js'
import { postsRoutes } from './routes/posts.routes.js'
import { brandsRoutes } from './routes/brands.routes.js'
import { brandProfileRoutes } from './routes/brand-profile.routes.js'
import { audienceSignalRoutes } from './routes/audience-signal.routes.js'
import { postsPerformanceRoutes } from './routes/posts-performance.routes.js'
import { performanceInsightsRoutes } from './routes/performance-insights.routes.js'
import { performanceSuggestionsRoutes } from './routes/performance-suggestions.routes.js'
import { pautaRoutes } from './routes/pauta.routes.js'
import { generationRoutes } from './routes/generation.routes.js'
import { videosRoutes } from './routes/videos.routes.js'
import { mediaRoutes } from './routes/media.routes.js'
import { campaignsRoutes } from './routes/campaigns.routes.js'
import { autonomyTickLogRoutes } from './routes/autonomy-tick-log.routes.js'
import { registerAuthMiddleware } from './middleware/auth.middleware.js'

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: process.env['LOG_LEVEL'] ?? 'info',
    },
  })

  await app.register(helmet)
  await app.register(cors, {
    origin: getAllowedWebOrigins(),
    credentials: true,
  })
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  })
  await app.register(multipart, {
    // 25MB acomoda um clipe curto de teste para TikTok (_local-adr-policy-036);
    // vídeos maiores exigiriam upload direto ao Cloud Storage, fora do escopo atual.
    limits: { fileSize: 25 * 1024 * 1024, files: 1 },
  })

  await registerAuthMiddleware(app)

  await app.register(healthRoutes)
  await app.register(linkedinOAuthRoutes)
  await app.register(linkedinPageOAuthRoutes)
  await app.register(metaOAuthRoutes)
  await app.register(instagramOAuthRoutes)
  await app.register(xOAuthRoutes)
  await app.register(tiktokOAuthRoutes)
  await app.register(postsRoutes)
  await app.register(videosRoutes)
  await app.register(mediaRoutes)
  await app.register(brandsRoutes)
  await app.register(brandProfileRoutes)
  await app.register(audienceSignalRoutes)
  await app.register(postsPerformanceRoutes)
  await app.register(performanceInsightsRoutes)
  await app.register(performanceSuggestionsRoutes)
  await app.register(pautaRoutes)
  await app.register(generationRoutes)
  await app.register(campaignsRoutes)
  await app.register(autonomyTickLogRoutes)

  return app
}
