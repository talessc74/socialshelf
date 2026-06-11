import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { PublishPostUseCase } from '../use-cases/PublishPostUseCase.js'
import { FirestorePostRepository } from '../infrastructure/firestore/FirestorePostRepository.js'
import { FirestoreOAuthRepository } from '../infrastructure/firestore/FirestoreOAuthRepository.js'
import { SecretManagerTokenVault } from '../infrastructure/secret-manager/SecretManagerTokenVault.js'
import { LinkedInPublisher } from '../infrastructure/publishers/LinkedInPublisher.js'
import { MetaPublisher } from '../infrastructure/publishers/MetaPublisher.js'
import { XPublisher } from '../infrastructure/publishers/XPublisher.js'
import { Platform } from '@socialshelf/domain'
import type { PublisherPort } from '@socialshelf/domain'

const bodySchema = z.object({
  postId: z.string().min(1),
  brandId: z.string().min(1),
})

export async function publishRoutes(app: FastifyInstance) {
  const postRepo = new FirestorePostRepository()
  const oauthRepo = new FirestoreOAuthRepository()
  const tokenVault = new SecretManagerTokenVault()

  const publishers = new Map<Platform, PublisherPort>([
    [Platform.LINKEDIN, new LinkedInPublisher(tokenVault)],
    [Platform.FACEBOOK, new MetaPublisher(tokenVault)],
    [Platform.INSTAGRAM, new MetaPublisher(tokenVault)],
    [Platform.TWITTER, new XPublisher(tokenVault)],
  ])

  const useCase = new PublishPostUseCase(postRepo, oauthRepo, tokenVault, publishers)
  const internalSecret = process.env['INTERNAL_SECRET']

  if (!internalSecret) {
    throw new Error('INTERNAL_SECRET env var is required — set it before starting the publisher service')
  }

  app.post('/publish', async (request, reply) => {
    const header = request.headers['x-internal-secret']
    if (header !== internalSecret) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    const parsed = bodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid request body' })
    }

    const { postId, brandId } = parsed.data

    try {
      const result = await useCase.execute(postId, brandId)
      return reply.send(result)
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('Post not found')) {
        return reply.status(404).send({ error: err.message })
      }
      const detail = err instanceof Error ? err.message : String(err)
      app.log.error({ err }, 'publish use-case failed')
      return reply.status(500).send({ error: 'Internal error', detail })
    }
  })
}
