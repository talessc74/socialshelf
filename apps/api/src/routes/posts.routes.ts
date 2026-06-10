import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { Platform } from '@socialshelf/domain'
import { CreatePostUseCase } from '../use-cases/posts/CreatePostUseCase.js'
import { FirestorePostRepository } from '../infrastructure/firestore/FirestorePostRepository.js'
import { FirestoreOAuthRepository } from '../infrastructure/firestore/FirestoreOAuthRepository.js'

const platformEnum = z.enum([
  Platform.LINKEDIN,
  Platform.FACEBOOK,
  Platform.INSTAGRAM,
  Platform.TWITTER,
])

const createPostSchema = z.object({
  content: z
    .array(z.object({ platform: platformEnum, text: z.string().min(1) }))
    .min(1),
  imageStoragePaths: z.array(z.string()).optional(),
})

export async function postsRoutes(app: FastifyInstance) {
  const postRepo = new FirestorePostRepository()
  const oauthRepo = new FirestoreOAuthRepository()
  const createPost = new CreatePostUseCase(postRepo)

  const publisherUrl = process.env['PUBLISHER_URL'] ?? 'http://localhost:3002'
  const internalSecret = process.env['INTERNAL_SECRET'] ?? ''

  // List OAuth connections for current user (brandId = userId for Sprint 1)
  app.get(
    '/connections',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const connections = await oauthRepo.findByBrand(request.userId)
      const safe = connections.map(({ tokenRef: _tokenRef, ...rest }) => rest)
      return reply.send({ connections: safe })
    },
  )

  // Create a post
  app.post(
    '/posts',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const parsed = createPostSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid request body', details: parsed.error.flatten() })
      }

      try {
        const post = await createPost.execute({
          userId: request.userId,
          brandId: request.userId,
          content: parsed.data.content as Array<{ platform: Platform; text: string }>,
          ...(parsed.data.imageStoragePaths !== undefined && { imageStoragePaths: parsed.data.imageStoragePaths }),
        })
        return reply.status(201).send({ post })
      } catch (err) {
        if (err instanceof Error && err.message.includes('exceeds')) {
          return reply.status(422).send({ error: err.message })
        }
        app.log.error(err)
        return reply.status(500).send({ error: 'Internal error' })
      }
    },
  )

  // Publish a post immediately
  app.post(
    '/posts/:id/publish',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string }

      const res = await fetch(`${publisherUrl}/publish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Secret': internalSecret,
        },
        body: JSON.stringify({ postId: id, brandId: request.userId }),
      })

      if (!res.ok) {
        const body = await res.text()
        if (res.status === 404) return reply.status(404).send({ error: 'Post not found' })
        app.log.error(`Publisher error ${res.status}: ${body}`)
        return reply.status(502).send({ error: 'Publisher error' })
      }

      return reply.send(await res.json())
    },
  )
}
