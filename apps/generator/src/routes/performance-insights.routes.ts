import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { Platform } from '@socialshelf/domain'
import { AnalyzePerformancePatternsUseCase } from '../use-cases/AnalyzePerformancePatternsUseCase.js'
import { GeminiPatternAnalyzer } from '../infrastructure/vertexai/GeminiPatternAnalyzer.js'
import { FirestoreProfileDiagnosticRepository } from '../infrastructure/firestore/FirestoreProfileDiagnosticRepository.js'

const platformEnum = z.enum([
  Platform.LINKEDIN,
  Platform.FACEBOOK,
  Platform.INSTAGRAM,
  Platform.TWITTER,
])

const bodySchema = z.object({
  brandId: z.string().min(1),
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

const latestQuerySchema = z.object({ brandId: z.string().min(1) })

export async function performanceInsightsRoutes(app: FastifyInstance) {
  const projectId = process.env['GCP_PROJECT_ID'] ?? ''
  const geminiLocation = process.env['GEMINI_LOCATION'] ?? 'global'
  const geminiModel = process.env['GEMINI_MODEL'] ?? 'gemini-2.5-flash'

  const patternAnalyzer = new GeminiPatternAnalyzer(projectId, geminiLocation, geminiModel)
  const diagnosticRepo = new FirestoreProfileDiagnosticRepository()
  const useCase = new AnalyzePerformancePatternsUseCase(patternAnalyzer, diagnosticRepo)

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
      const insights = await useCase.execute(parsed.data.brandId, parsed.data.entries)
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

  app.get('/performance-insights/latest', async (request, reply) => {
    const header = request.headers['x-internal-secret']
    if (header !== internalSecret) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    const parsed = latestQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid query params', details: parsed.error.flatten() })
    }

    try {
      const record = await diagnosticRepo.findLatestByBrand(parsed.data.brandId)
      return reply.send({ record })
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      app.log.error({ err }, 'find latest profile diagnostic failed')
      return reply.status(500).send({ error: 'Internal error', detail })
    }
  })
}
