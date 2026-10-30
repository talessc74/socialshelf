import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { ExtractBrandProfileFromDocumentUseCase } from '../use-cases/ExtractBrandProfileFromDocumentUseCase.js'
import { GeminiBrandDocumentExtractor } from '../infrastructure/vertexai/GeminiBrandDocumentExtractor.js'
import { FirestoreAiUsageRepository } from '../infrastructure/firestore/FirestoreAiUsageRepository.js'

const bodySchema = z.object({
  base64: z.string().min(1),
  mimeType: z.enum(['application/pdf', 'text/plain']),
  // Atribuição de custo de IA (Fase 0 de billing) — o apps/api (único chamador real) já tem os
  // dois em mãos via request.userId/request.brandId quando faz o proxy desta chamada.
  userId: z.string().min(1),
  brandId: z.string().min(1),
})

export async function brandProfileRoutes(app: FastifyInstance) {
  const projectId = process.env['GCP_PROJECT_ID'] ?? ''
  const geminiLocation = process.env['GEMINI_LOCATION'] ?? 'global'
  const geminiModel = process.env['GEMINI_MODEL'] ?? 'gemini-2.5-flash'

  const aiUsageRepo = new FirestoreAiUsageRepository()
  const extractor = new GeminiBrandDocumentExtractor(projectId, geminiLocation, geminiModel, aiUsageRepo)
  const useCase = new ExtractBrandProfileFromDocumentUseCase(extractor)

  const internalSecret = process.env['INTERNAL_SECRET']
  if (!internalSecret) {
    throw new Error('INTERNAL_SECRET env var is required — set it before starting the generator service')
  }

  app.post('/brand-profile/extract', async (request, reply) => {
    const header = request.headers['x-internal-secret']
    if (header !== internalSecret) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    const parsed = bodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid request body', details: parsed.error.flatten() })
    }

    try {
      const extraction = await useCase.execute(parsed.data.base64, parsed.data.mimeType, parsed.data.userId, parsed.data.brandId)
      return reply.send({ extraction })
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      app.log.error({ err }, 'extract brand profile from document use-case failed')
      return reply.status(500).send({ error: 'Internal error', detail })
    }
  })
}
