import Fastify from 'fastify'
import helmet from '@fastify/helmet'
import multipart from '@fastify/multipart'
import { healthRoutes } from './routes/health.routes.js'
import { pautaRoutes } from './routes/pauta.routes.js'
import { generationRoutes } from './routes/generation.routes.js'
import { videoRoutes } from './routes/video.routes.js'
import { performanceInsightsRoutes } from './routes/performance-insights.routes.js'
import { performanceSuggestionsRoutes } from './routes/performance-suggestions.routes.js'
import { brandProfileRoutes } from './routes/brand-profile.routes.js'
import { campaignCaptionRoutes } from './routes/campaign-caption.routes.js'

export async function buildApp() {
  const app = Fastify({
    logger: { level: process.env['LOG_LEVEL'] ?? 'info' },
    // Imagens e vídeos chegam em /images/upload e /videos/upload como JSON com o arquivo
    // em base64 (não multipart), então precisam superar o limite padrão de 1MB do Fastify —
    // base64 infla o arquivo original em ~33%. Vídeo (até ~25MB no upload de origem, ver
    // apps/api/src/app.ts) é o maior caso hoje, por isso o limite é dimensionado por ele.
    bodyLimit: 35 * 1024 * 1024,
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
  await app.register(videoRoutes)
  await app.register(performanceInsightsRoutes)
  await app.register(performanceSuggestionsRoutes)
  await app.register(brandProfileRoutes)
  await app.register(campaignCaptionRoutes)

  return app
}
