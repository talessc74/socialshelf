import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { GeneratePerformanceSuggestionsUseCase } from '../use-cases/GeneratePerformanceSuggestionsUseCase.js'
import { RecordPerformanceSuggestionFeedbackUseCase } from '../use-cases/RecordPerformanceSuggestionFeedbackUseCase.js'
import { SetPerformanceSuggestionShelvedUseCase } from '../use-cases/SetPerformanceSuggestionShelvedUseCase.js'
import { GeminiPerformanceSuggester } from '../infrastructure/vertexai/GeminiPerformanceSuggester.js'
import { FirestorePerformanceSuggestionRepository } from '../infrastructure/firestore/FirestorePerformanceSuggestionRepository.js'

const profileDiagnosticSchema = z.object({
  niche: z.string(),
  diagnosisSummary: z.string(),
  viralPotential: z.number(),
  whatWorks: z.array(z.object({ title: z.string(), description: z.string() })),
  engagingThemes: z.array(z.object({ label: z.string(), strength: z.number() })),
  topFormats: z.array(z.string()),
  bestTimes: z.array(z.string()),
  engagementAnalysis: z.string(),
  actionPlan: z.array(z.object({ title: z.string(), description: z.string() })),
})

const generateBodySchema = z.object({
  brandId: z.string().min(1),
  diagnostic: profileDiagnosticSchema,
})

const feedbackBodySchema = z.object({
  brandId: z.string().min(1),
  feedback: z.enum(['helpful', 'not_helpful']),
})

const shelveBodySchema = z.object({
  brandId: z.string().min(1),
  shelved: z.boolean(),
})

const shelvedQuerySchema = z.object({
  brandId: z.string().min(1),
})

export async function performanceSuggestionsRoutes(app: FastifyInstance) {
  const projectId = process.env['GCP_PROJECT_ID'] ?? ''
  const geminiLocation = process.env['GEMINI_LOCATION'] ?? 'global'
  const geminiModel = process.env['GEMINI_MODEL'] ?? 'gemini-2.5-flash'

  const suggester = new GeminiPerformanceSuggester(projectId, geminiLocation, geminiModel)
  const suggestionRepo = new FirestorePerformanceSuggestionRepository()
  const generateUseCase = new GeneratePerformanceSuggestionsUseCase(suggester, suggestionRepo)
  const feedbackUseCase = new RecordPerformanceSuggestionFeedbackUseCase(suggestionRepo)
  const shelveUseCase = new SetPerformanceSuggestionShelvedUseCase(suggestionRepo)

  const internalSecret = process.env['INTERNAL_SECRET']
  if (!internalSecret) {
    throw new Error('INTERNAL_SECRET env var is required — set it before starting the generator service')
  }

  app.post('/performance-suggestions/generate', async (request, reply) => {
    const header = request.headers['x-internal-secret']
    if (header !== internalSecret) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    const parsed = generateBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid request body', details: parsed.error.flatten() })
    }

    try {
      const suggestions = await generateUseCase.execute(parsed.data.brandId, parsed.data.diagnostic)
      return reply.send({ suggestions })
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      app.log.error({ err }, 'generate performance suggestions use-case failed')
      return reply.status(500).send({ error: 'Internal error', detail })
    }
  })

  app.post('/performance-suggestions/:id/feedback', async (request, reply) => {
    const header = request.headers['x-internal-secret']
    if (header !== internalSecret) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    const { id } = request.params as { id: string }
    const parsed = feedbackBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid request body', details: parsed.error.flatten() })
    }

    try {
      await feedbackUseCase.execute(parsed.data.brandId, id, parsed.data.feedback)
      return reply.send({ ok: true })
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      app.log.error({ err }, 'record performance suggestion feedback use-case failed')
      return reply.status(500).send({ error: 'Internal error', detail })
    }
  })

  app.post('/performance-suggestions/:id/shelve', async (request, reply) => {
    const header = request.headers['x-internal-secret']
    if (header !== internalSecret) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    const { id } = request.params as { id: string }
    const parsed = shelveBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid request body', details: parsed.error.flatten() })
    }

    try {
      await shelveUseCase.execute(parsed.data.brandId, id, parsed.data.shelved)
      return reply.send({ ok: true })
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      app.log.error({ err }, 'set performance suggestion shelved use-case failed')
      return reply.status(500).send({ error: 'Internal error', detail })
    }
  })

  app.get('/performance-suggestions/shelved', async (request, reply) => {
    const header = request.headers['x-internal-secret']
    if (header !== internalSecret) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    const parsed = shelvedQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid query params', details: parsed.error.flatten() })
    }

    try {
      const suggestions = await suggestionRepo.findShelvedByBrand(parsed.data.brandId, parsed.data.brandId)
      return reply.send({ suggestions })
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      app.log.error({ err }, 'find shelved performance suggestions failed')
      return reply.status(500).send({ error: 'Internal error', detail })
    }
  })
}
