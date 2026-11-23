import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { Platform } from '@socialshelf/domain'
import { AnswerSelfieQuestionUseCase } from '../use-cases/AnswerSelfieQuestionUseCase.js'
import { GeminiSelfieAssistant } from '../infrastructure/vertexai/GeminiSelfieAssistant.js'
import { FirestoreAiUsageRepository } from '../infrastructure/firestore/FirestoreAiUsageRepository.js'

const platformEnum = z.enum([
  Platform.LINKEDIN,
  Platform.FACEBOOK,
  Platform.INSTAGRAM,
  Platform.TWITTER,
  Platform.TIKTOK,
])

const bodySchema = z.object({
  userId: z.string().min(1),
  brandId: z.string().min(1),
  // Limite curto o bastante para impedir abuso óbvio sem travar perguntas reais — o rate
  // limit global do apps/api (100 req/min) é a defesa principal contra volume.
  question: z.string().min(1).max(1000),
  history: z
    .array(z.object({ role: z.enum(['user', 'selfie']), text: z.string().max(2000) }))
    .max(10)
    .default([]),
  accountStatus: z
    .array(
      z.object({
        platform: platformEnum,
        connected: z.boolean(),
        accountLabel: z.string().nullable(),
        connectionLikelyExpired: z.boolean(),
      }),
    )
    .default([]),
})

export async function selfieRoutes(app: FastifyInstance) {
  const projectId = process.env['GCP_PROJECT_ID'] ?? ''
  const geminiLocation = process.env['GEMINI_LOCATION'] ?? 'global'
  const geminiModel = process.env['GEMINI_MODEL'] ?? 'gemini-2.5-flash'

  const aiUsageRepo = new FirestoreAiUsageRepository()
  const assistant = new GeminiSelfieAssistant(projectId, geminiLocation, geminiModel, aiUsageRepo)
  const useCase = new AnswerSelfieQuestionUseCase(assistant)

  const internalSecret = process.env['INTERNAL_SECRET']
  if (!internalSecret) {
    throw new Error('INTERNAL_SECRET env var is required — set it before starting the generator service')
  }

  app.post('/selfie/ask', async (request, reply) => {
    const header = request.headers['x-internal-secret']
    if (header !== internalSecret) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    const parsed = bodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid request body', details: parsed.error.flatten() })
    }

    try {
      const answer = await useCase.execute(
        parsed.data.question,
        parsed.data.history,
        parsed.data.accountStatus,
        parsed.data.userId,
        parsed.data.brandId,
      )
      return reply.send({ answer })
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      app.log.error({ err }, 'answer selfie question use-case failed')
      return reply.status(500).send({ error: 'Internal error', detail })
    }
  })
}
