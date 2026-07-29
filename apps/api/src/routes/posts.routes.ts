import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { Platform, MAX_GENERATION_ARTIFACTS } from '@socialshelf/domain'
import { CreatePostUseCase } from '../use-cases/posts/CreatePostUseCase.js'
import { UpdatePostUseCase } from '../use-cases/posts/UpdatePostUseCase.js'
import { DeletePostUseCase } from '../use-cases/posts/DeletePostUseCase.js'
import { SetPostSavedForLaterUseCase } from '../use-cases/posts/SetPostSavedForLaterUseCase.js'
import { FirestorePostRepository } from '../infrastructure/firestore/FirestorePostRepository.js'
import { FirestoreOAuthRepository } from '../infrastructure/firestore/FirestoreOAuthRepository.js'
import { FirestoreBrandProfileRepository } from '../infrastructure/firestore/FirestoreBrandProfileRepository.js'
import { fetchInternal } from '../lib/serviceAuth.js'

const platformEnum = z.enum([
  Platform.LINKEDIN,
  Platform.FACEBOOK,
  Platform.INSTAGRAM,
  Platform.TWITTER,
  Platform.TIKTOK,
])

const createPostSchema = z.object({
  content: z
    .array(z.object({ platform: platformEnum, text: z.string().min(1) }))
    .min(1),
  // Teto real do carrossel do Instagram via Graph API (packages/domain/entities/Platform.ts)
  // — o cliente já desabilita o upload além disso, mas o backend não deve confiar só na UI.
  imageStoragePaths: z.array(z.string()).max(MAX_GENERATION_ARTIFACTS).optional(),
  videoStoragePath: z.string().nullable().optional(),
  videoConsentAcceptedAt: z.string().datetime().nullable().optional(),
  scheduledAt: z.string().datetime().optional(),
  sourceArticleUrl: z.string().nullable().optional(),
})

const listPostsQuerySchema = z.object({
  status: z.enum(['draft', 'ai-draft', 'scheduled', 'published', 'failed']).optional(),
})

const updatePostSchema = z.object({
  content: z
    .array(z.object({ platform: platformEnum, text: z.string().min(1) }))
    .min(1),
  imageStoragePaths: z.array(z.string()).max(MAX_GENERATION_ARTIFACTS).optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
})

export async function postsRoutes(app: FastifyInstance) {
  const postRepo = new FirestorePostRepository()
  const oauthRepo = new FirestoreOAuthRepository()
  const brandProfileRepo = new FirestoreBrandProfileRepository()
  const createPost = new CreatePostUseCase(postRepo, brandProfileRepo)
  const updatePost = new UpdatePostUseCase(postRepo)
  const deletePost = new DeletePostUseCase(postRepo)
  const setSavedForLater = new SetPostSavedForLaterUseCase(postRepo)

  const publisherUrl = process.env['PUBLISHER_URL'] ?? 'http://localhost:3002'
  const internalSecret = process.env['INTERNAL_SECRET'] ?? ''

  // List OAuth connections for the active brand
  app.get(
    '/connections',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const connections = await oauthRepo.findByBrand(request.userId, request.brandId)
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

      const posts = await postRepo.findByBrand(request.userId, request.brandId, parsed.data.status)
      const sorted = [...posts].sort(
        (a, b) => (a.scheduledAt ?? a.createdAt).getTime() - (b.scheduledAt ?? b.createdAt).getTime(),
      )
      return reply.send({ posts: sorted })
    },
  )

  // List posts marcados "guardar para depois" — rota estática, o find-my-way do Fastify
  // sempre prioriza um segmento literal sobre o parâmetro de /posts/:id abaixo, então a
  // ordem de registro aqui não importa pra evitar colisão.
  app.get(
    '/posts/saved-for-later',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const posts = await postRepo.findSavedForLaterByBrand(request.userId, request.brandId)
      return reply.send({ posts })
    },
  )

  // Get a single post by id
  app.get(
    '/posts/:id',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const post = await postRepo.findByIdAndBrand(id, request.userId, request.brandId)
      if (!post) return reply.status(404).send({ error: 'Post not found' })
      return reply.send({ post })
    },
  )

  // Marca ou desmarca um rascunho como "guardado para depois" — não muda status nem
  // qualquer outro campo, só adia a decisão de aprovar/descartar.
  app.post(
    '/posts/:id/save-for-later',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const parsed = z.object({ savedForLater: z.boolean() }).safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid request body', details: parsed.error.flatten() })
      }

      const existing = await postRepo.findByIdAndBrand(id, request.userId, request.brandId)
      if (!existing) return reply.status(404).send({ error: 'Post not found' })

      const post = await setSavedForLater.execute(existing, parsed.data.savedForLater)
      return reply.send({ post })
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
          brandId: request.brandId,
          content: parsed.data.content as Array<{ platform: Platform; text: string }>,
          ...(parsed.data.imageStoragePaths !== undefined && { imageStoragePaths: parsed.data.imageStoragePaths }),
          ...(parsed.data.videoStoragePath !== undefined && { videoStoragePath: parsed.data.videoStoragePath }),
          ...(parsed.data.videoConsentAcceptedAt !== undefined && {
            videoConsentAcceptedAt: parsed.data.videoConsentAcceptedAt
              ? new Date(parsed.data.videoConsentAcceptedAt)
              : null,
          }),
          ...(parsed.data.scheduledAt !== undefined && { scheduledAt: new Date(parsed.data.scheduledAt) }),
          ...(parsed.data.sourceArticleUrl !== undefined && { sourceArticleUrl: parsed.data.sourceArticleUrl }),
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

      const existing = await postRepo.findByIdAndBrand(id, request.userId, request.brandId)
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
        body: JSON.stringify({ postId: id, userId: request.userId, brandId: request.brandId }),
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

  // Delete a post
  app.delete(
    '/posts/:id',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string }

      const existing = await postRepo.findByIdAndBrand(id, request.userId, request.brandId)
      if (!existing) return reply.status(404).send({ error: 'Post not found' })

      try {
        await deletePost.execute(id, request.userId, request.brandId)
        return reply.status(204).send()
      } catch (err) {
        app.log.error(err)
        return reply.status(500).send({ error: 'Internal error' })
      }
    },
  )
}
