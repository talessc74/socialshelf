import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { GetPostsPerformanceUseCase } from '../use-cases/GetPostsPerformanceUseCase.js'
import { FirestorePostRepository } from '../infrastructure/firestore/FirestorePostRepository.js'
import { FirestoreOAuthRepository } from '../infrastructure/firestore/FirestoreOAuthRepository.js'
import { FirestoreTokenVault } from '../infrastructure/firestore/FirestoreTokenVault.js'
import { LinkedInAnalyticsReader } from '../infrastructure/analytics/LinkedInAnalyticsReader.js'
import { MetaAnalyticsReader } from '../infrastructure/analytics/MetaAnalyticsReader.js'
import { XAnalyticsReader } from '../infrastructure/analytics/XAnalyticsReader.js'
import { Platform } from '@socialshelf/domain'
import type { AnalyticsReaderPort } from '@socialshelf/domain'

const bodySchema = z.object({
  brandId: z.string().min(1),
})

export async function postsPerformanceRoutes(app: FastifyInstance) {
  const postRepo = new FirestorePostRepository()
  const oauthRepo = new FirestoreOAuthRepository()
  const tokenVault = new FirestoreTokenVault()

  const readers = new Map<Platform, AnalyticsReaderPort>([
    [Platform.LINKEDIN, new LinkedInAnalyticsReader(tokenVault)],
    [Platform.FACEBOOK, new MetaAnalyticsReader(tokenVault)],
    [Platform.INSTAGRAM, new MetaAnalyticsReader(tokenVault)],
    [Platform.TWITTER, new XAnalyticsReader(tokenVault)],
  ])

  const useCase = new GetPostsPerformanceUseCase(postRepo, oauthRepo, readers)
  const internalSecret = process.env['INTERNAL_SECRET']

  if (!internalSecret) {
    throw new Error('INTERNAL_SECRET env var is required — set it before starting the publisher service')
  }

  app.post('/posts-performance', async (request, reply) => {
    const header = request.headers['x-internal-secret']
    if (header !== internalSecret) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    const parsed = bodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid request body' })
    }

    try {
      const { entries, errors } = await useCase.execute(parsed.data.brandId)
      return reply.send({ entries, errors })
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      app.log.error({ err }, 'get posts performance use-case failed')
      return reply.status(500).send({ error: 'Internal error', detail })
    }
  })
}
