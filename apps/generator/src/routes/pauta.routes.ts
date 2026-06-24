import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { SuggestTopicsUseCase } from '../use-cases/SuggestTopicsUseCase.js'
import { GoogleNewsRssReader } from '../infrastructure/news/GoogleNewsRssReader.js'
import { OgImageThumbnailFetcher } from '../infrastructure/news/OgImageThumbnailFetcher.js'
import { GeminiTranslator } from '../infrastructure/vertexai/GeminiTranslator.js'
import { FirestoreBrandProfileRepository } from '../infrastructure/firestore/FirestoreBrandProfileRepository.js'
import { FirestoreAudienceSignalRepository } from '../infrastructure/firestore/FirestoreAudienceSignalRepository.js'
import { FirestoreTopicSuggestionRepository } from '../infrastructure/firestore/FirestoreTopicSuggestionRepository.js'
import { getTrustedDomains } from '../lib/factVerification.js'

const bodySchema = z.object({ brandId: z.string().min(1) })

export async function pautaRoutes(app: FastifyInstance) {
  const projectId = process.env['GCP_PROJECT_ID'] ?? ''
  const geminiLocation = process.env['GEMINI_LOCATION'] ?? 'global'
  const geminiModel = process.env['GEMINI_MODEL'] ?? 'gemini-2.5-flash'

  const newsSource = new GoogleNewsRssReader()
  const translator = new GeminiTranslator(projectId, geminiLocation, geminiModel)
  const thumbnailFetcher = new OgImageThumbnailFetcher()
  const brandProfileRepo = new FirestoreBrandProfileRepository()
  const audienceSignalRepo = new FirestoreAudienceSignalRepository()
  const topicSuggestionRepo = new FirestoreTopicSuggestionRepository()

  const useCase = new SuggestTopicsUseCase(
    newsSource,
    translator,
    thumbnailFetcher,
    brandProfileRepo,
    audienceSignalRepo,
    topicSuggestionRepo,
    getTrustedDomains(),
  )
  const internalSecret = process.env['INTERNAL_SECRET']

  if (!internalSecret) {
    throw new Error('INTERNAL_SECRET env var is required — set it before starting the generator service')
  }

  app.post('/pauta/suggest', async (request, reply) => {
    const header = request.headers['x-internal-secret']
    if (header !== internalSecret) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    const parsed = bodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid request body' })
    }

    try {
      const suggestions = await useCase.execute(parsed.data.brandId)
      return reply.send({ suggestions })
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('No brand profile')) {
        return reply.status(404).send({ error: err.message })
      }
      const detail = err instanceof Error ? err.message : String(err)
      app.log.error({ err }, 'suggest topics use-case failed')
      return reply.status(500).send({ error: 'Internal error', detail })
    }
  })
}
