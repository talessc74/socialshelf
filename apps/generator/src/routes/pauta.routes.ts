import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { SuggestTopicsUseCase } from '../use-cases/SuggestTopicsUseCase.js'
import { NewsApiOrgReader } from '../infrastructure/news/NewsApiOrgReader.js'
import { FirestoreBrandProfileRepository } from '../infrastructure/firestore/FirestoreBrandProfileRepository.js'
import { FirestoreAudienceSignalRepository } from '../infrastructure/firestore/FirestoreAudienceSignalRepository.js'
import { FirestoreTopicSuggestionRepository } from '../infrastructure/firestore/FirestoreTopicSuggestionRepository.js'
import { getTrustedDomains } from '../lib/factVerification.js'

const bodySchema = z.object({ brandId: z.string().min(1) })

export async function pautaRoutes(app: FastifyInstance) {
  const newsApiKey = process.env['NEWS_API_KEY'] ?? ''
  const newsSource = new NewsApiOrgReader(newsApiKey)
  const brandProfileRepo = new FirestoreBrandProfileRepository()
  const audienceSignalRepo = new FirestoreAudienceSignalRepository()
  const topicSuggestionRepo = new FirestoreTopicSuggestionRepository()

  const useCase = new SuggestTopicsUseCase(
    newsSource,
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
