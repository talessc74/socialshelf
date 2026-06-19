import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { Platform } from '@socialshelf/domain'
import { AnalyzePerformancePatternsUseCase } from '../use-cases/AnalyzePerformancePatternsUseCase.js'
import { GeminiPatternAnalyzer } from '../infrastructure/vertexai/GeminiPatternAnalyzer.js'

const platformEnum = z.enum([
  Platform.LINKEDIN,
  Platform.FACEBOOK,
  Platform.INSTAGRAM,
  Platform.TWITTER,
])

const bodySchema = z.object({
  entries: z.array(
    z.object({
      platform: platformEnum,
      text: z.string(),
      metrics: z.object({
        impressions: z.number(),
        likes: z.number(),
        comments: z.number(),
        shares: z.number(),
      }),
      score: z.number(),
    }),
  ),
})

export async function performanceInsightsRoutes(app: FastifyInstance) {
  const projectId = process.env['GCP_PROJECT_ID'] ?? ''
  const location = process.env['VERTEX_AI_LOCATION'] ?? 'us-central1'
  const geminiModel = process.env['GEMINI_MODEL'] ?? 'gemini-2.0-flash'

  const patternAnalyzer = new GeminiPatternAnalyzer(projectId, location, geminiModel)
  const useCase = new AnalyzePerformancePatternsUseCase(patternAnalyzer)

  const internalSecret = process.env['INTERNAL_SECRET']
  if (!internalSecret) {
    throw new Error('INTERNAL_SECRET env var is required — set it before starting the generator service')
  }

  app.post('/performance-insights/analyze', async (request, reply) => {
    const header = request.headers['x-internal-secret']
    if (header !== internalSecret) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    const parsed = bodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid request body', details: parsed.error.flatten() })
    }

    try {
      const insights = await useCase.execute(parsed.data.entries)
      return reply.send({ insights })
    } catch (err) {
      if (err instanceof Error && err.message === 'No published posts with metrics to analyze') {
        return reply.status(400).send({ error: err.message })
      }
      const detail = err instanceof Error ? err.message : String(err)
      app.log.error({ err }, 'analyze performance patterns use-case failed')
      return reply.status(500).send({ error: 'Internal error', detail })
    }
  })
}
