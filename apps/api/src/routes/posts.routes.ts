import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { Platform } from '@socialshelf/domain'
import { CreatePostUseCase } from '../use-cases/posts/CreatePostUseCase.js'
import { UpdatePostUseCase } from '../use-cases/posts/UpdatePostUseCase.js'
import { FirestorePostRepository } from '../infrastructure/firestore/FirestorePostRepository.js'
import { FirestoreOAuthRepository } from '../infrastructure/firestore/FirestoreOAuthRepository.js'
import { FirestoreBrandProfileRepository } from '../infrastructure/firestore/FirestoreBrandProfileRepository.js'
import { fetchInternal } from '../lib/serviceAuth.js'

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
  scheduledAt: z.string().datetime().optional(),
})

const listPostsQuerySchema = z.object({
  status: z.enum(['draft', 'ai-draft', 'scheduled', 'published', 'failed']).optional(),
})

const updatePostSchema = z.object({
  content: z
    .array(z.object({ platform: platformEnum, text: z.string().min(1) }))
    .min(1),
  imageStoragePaths: z.array(z.string()).optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
})

export async function postsRoutes(app: FastifyInstance) {
  const postRepo = new FirestorePostRepository()
  const oauthRepo = new FirestoreOAuthRepository()
  const brandProfileRepo = new FirestoreBrandProfileRepository()
  const createPost = new CreatePostUseCase(postRepo, brandProfileRepo)
  const updatePost = new UpdatePostUseCase(postRepo)

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

  // List posts for the current user/brand, optionally filtered by status
  app.get(
    '/posts',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const parsed = listPostsQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid query', details: parsed.error.flatten() })
      }

      const posts = await postRepo.findByBrand(request.userId, parsed.data.status)
      const sorted = [...posts].sort(
        (a, b) => (a.scheduledAt ?? a.createdAt).getTime() - (b.scheduledAt ?? b.createdAt).getTime(),
      )
      return reply.send({ posts: sorted })
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
          ...(parsed.data.scheduledAt !== undefined && { scheduledAt: new Date(parsed.data.scheduledAt) }),
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

  // Update a post's content
  app.put(
    '/posts/:id',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const parsed = updatePostSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid request body', details: parsed.error.flatten() })
      }

      const existing = await postRepo.findByIdAndBrand(id, request.userId)
      if (!existing) return reply.status(404).send({ error: 'Post not found' })

      try {
        const post = await updatePost.execute({
          post: existing,
          content: parsed.data.content as Array<{ platform: Platform; text: string }>,
          ...(parsed.data.imageStoragePaths !== undefined && { imageStoragePaths: parsed.data.imageStoragePaths }),
          ...(parsed.data.scheduledAt !== undefined && {
            scheduledAt: parsed.data.scheduledAt === null ? null : new Date(parsed.data.scheduledAt),
          }),
        })
        return reply.send({ post })
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

      const res = await fetchInternal(`${publisherUrl}/publish`, {
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
        return reply.status(502).send({ error: 'Publisher error', detail: body })
      }

      return reply.send(await res.json())
    },
  )
}
