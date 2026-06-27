import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { PublishPostUseCase } from '../use-cases/PublishPostUseCase.js'
import { FirestorePostRepository } from '../infrastructure/firestore/FirestorePostRepository.js'
import { FirestoreOAuthRepository } from '../infrastructure/firestore/FirestoreOAuthRepository.js'
import { FirestoreTokenVault } from '../infrastructure/firestore/FirestoreTokenVault.js'
import { LinkedInPublisher } from '../infrastructure/publishers/LinkedInPublisher.js'
import { MetaPublisher } from '../infrastructure/publishers/MetaPublisher.js'
import { XPublisher } from '../infrastructure/publishers/XPublisher.js'
import { fetchInternal } from '../lib/serviceAuth.js'
import { Platform } from '@socialshelf/domain'
import type { PublisherPort } from '@socialshelf/domain'

const bodySchema = z.object({
  postId: z.string().min(1),
  userId: z.string().min(1),
  brandId: z.string().min(1),
})

export function buildPublishPostUseCase(): PublishPostUseCase {
  const postRepo = new FirestorePostRepository()
  const oauthRepo = new FirestoreOAuthRepository()
  const tokenVault = new FirestoreTokenVault()

  const internalSecret = process.env['INTERNAL_SECRET']
  const generatorUrl = process.env['GENERATOR_URL']

  if (!internalSecret) {
    throw new Error('INTERNAL_SECRET env var is required — set it before starting the publisher service')
  }
  if (!generatorUrl) {
    throw new Error('GENERATOR_URL env var is required — set it before starting the publisher service')
  }

  const resolveImageUrl = async (path: string): Promise<string> => {
    const res = await fetchInternal(`${generatorUrl}/images/signed-url?path=${encodeURIComponent(path)}`, {
      headers: { 'X-Internal-Secret': internalSecret },
    })
    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Failed to resolve image URL: ${res.status} ${err}`)
    }
    const data = (await res.json()) as { url: string }
    return data.url
  }

  const publishers = new Map<Platform, PublisherPort>([
    [Platform.LINKEDIN, new LinkedInPublisher(tokenVault)],
    [Platform.FACEBOOK, new MetaPublisher(tokenVault, resolveImageUrl)],
    [Platform.INSTAGRAM, new MetaPublisher(tokenVault, resolveImageUrl)],
    [Platform.TWITTER, new XPublisher(tokenVault)],
  ])

  return new PublishPostUseCase(postRepo, oauthRepo, tokenVault, publishers)
}

export async function publishRoutes(app: FastifyInstance) {
  const internalSecret = process.env['INTERNAL_SECRET']
  if (!internalSecret) {
    throw new Error('INTERNAL_SECRET env var is required — set it before starting the publisher service')
  }

  const useCase = buildPublishPostUseCase()

  app.post('/publish', async (request, reply) => {
    const header = request.headers['x-internal-secret']
    if (header !== internalSecret) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    const parsed = bodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid request body' })
    }

    const { postId, userId, brandId } = parsed.data

    try {
      const result = await useCase.execute(postId, userId, brandId)
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
