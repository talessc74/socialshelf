import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { ComputeAudienceSignalUseCase } from '../use-cases/ComputeAudienceSignalUseCase.js'
import { FirestorePostRepository } from '../infrastructure/firestore/FirestorePostRepository.js'
import { FirestoreOAuthRepository } from '../infrastructure/firestore/FirestoreOAuthRepository.js'
import { FirestoreAudienceSignalRepository } from '../infrastructure/firestore/FirestoreAudienceSignalRepository.js'
import { FirestoreTokenVault } from '../infrastructure/firestore/FirestoreTokenVault.js'
import { LinkedInAnalyticsReader } from '../infrastructure/analytics/LinkedInAnalyticsReader.js'
import { MetaAnalyticsReader } from '../infrastructure/analytics/MetaAnalyticsReader.js'
import { XAnalyticsReader } from '../infrastructure/analytics/XAnalyticsReader.js'
import { Platform } from '@socialshelf/domain'
import type { AnalyticsReaderPort } from '@socialshelf/domain'

const bodySchema = z.object({
  brandId: z.string().min(1),
  platform: z.nativeEnum(Platform),
})

export async function audienceSignalRoutes(app: FastifyInstance) {
  const postRepo = new FirestorePostRepository()
  const oauthRepo = new FirestoreOAuthRepository()
  const audienceSignalRepo = new FirestoreAudienceSignalRepository()
  const tokenVault = new FirestoreTokenVault()

  const readers = new Map<Platform, AnalyticsReaderPort>([
    [Platform.LINKEDIN, new LinkedInAnalyticsReader(tokenVault)],
    [Platform.FACEBOOK, new MetaAnalyticsReader(tokenVault)],
    [Platform.INSTAGRAM, new MetaAnalyticsReader(tokenVault)],
    [Platform.TWITTER, new XAnalyticsReader(tokenVault)],
  ])

  const useCase = new ComputeAudienceSignalUseCase(postRepo, oauthRepo, audienceSignalRepo, readers)
  const internalSecret = process.env['INTERNAL_SECRET']

  if (!internalSecret) {
    throw new Error('INTERNAL_SECRET env var is required — set it before starting the publisher service')
  }

  app.post('/audience-signal', async (request, reply) => {
    const header = request.headers['x-internal-secret']
    if (header !== internalSecret) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    const parsed = bodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid request body' })
    }

    const { brandId, platform } = parsed.data

    try {
      const signal = await useCase.execute(brandId, platform)
      return reply.send({ audienceSignal: signal })
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('No OAuth connection')) {
        return reply.status(404).send({ error: err.message })
      }
      const detail = err instanceof Error ? err.message : String(err)
      app.log.error({ err }, 'compute audience signal use-case failed')
      return reply.status(500).send({ error: 'Internal error', detail })
    }
  })
}
