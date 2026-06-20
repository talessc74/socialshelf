import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { Platform, TemplateStyle, AspectRatio } from '@socialshelf/domain'
import { GenerateContentUseCase } from '../use-cases/GenerateContentUseCase.js'
import { GeminiCopyGenerator } from '../infrastructure/vertexai/GeminiCopyGenerator.js'
import { ImagenImageGenerator } from '../infrastructure/vertexai/ImagenImageGenerator.js'
import { SharpTemplateRenderer } from '../infrastructure/template/SharpTemplateRenderer.js'
import { GcsImageStorage } from '../infrastructure/storage/GcsImageStorage.js'
import { FirestoreGenerationRequestRepository } from '../infrastructure/firestore/FirestoreGenerationRequestRepository.js'
import { FirestorePostRepository } from '../infrastructure/firestore/FirestorePostRepository.js'
import { FirestoreBrandProfileRepository } from '../infrastructure/firestore/FirestoreBrandProfileRepository.js'
import { FirestoreTopicSuggestionRepository } from '../infrastructure/firestore/FirestoreTopicSuggestionRepository.js'

const platformEnum = z.enum([
  Platform.LINKEDIN,
  Platform.FACEBOOK,
  Platform.INSTAGRAM,
  Platform.TWITTER,
])

const generateSchema = z.object({
  brandId: z.string().min(1),
  description: z.string().min(1),
  textContent: z.string().min(1).optional(),
  imageStoragePaths: z.array(z.string()).optional(),
  targetPlatforms: z.array(platformEnum).min(1),
  artifactCount: z.number().int().min(1).max(10).default(1),
  topicSuggestionId: z.string().min(1).optional(),
  style: z.nativeEnum(TemplateStyle).default(TemplateStyle.BOLD_BOTTOM),
  aspectRatio: z.nativeEnum(AspectRatio).default(AspectRatio.SQUARE),
})

export async function generationRoutes(app: FastifyInstance) {
  const projectId = process.env['GCP_PROJECT_ID'] ?? ''
  const location = process.env['VERTEX_AI_LOCATION'] ?? 'us-central1'
  const geminiLocation = process.env['GEMINI_LOCATION'] ?? 'global'
  const geminiModel = process.env['GEMINI_MODEL'] ?? 'gemini-2.5-flash'
  const imagenModel = process.env['IMAGEN_MODEL'] ?? 'imagen-4.0-generate-001'
  const generatedBucket = process.env['GCS_BUCKET_GENERATED'] ?? ''

  const copyGenerator = new GeminiCopyGenerator(projectId, geminiLocation, geminiModel)
  const imageGenerator = new ImagenImageGenerator(projectId, location, imagenModel)
  const templateRenderer = new SharpTemplateRenderer()
  const imageStorage = new GcsImageStorage(generatedBucket)
  const generationRequestRepo = new FirestoreGenerationRequestRepository()
  const postRepo = new FirestorePostRepository()
  const brandProfileRepo = new FirestoreBrandProfileRepository()
  const topicSuggestionRepo = new FirestoreTopicSuggestionRepository()

  const useCase = new GenerateContentUseCase(
    copyGenerator,
    imageGenerator,
    templateRenderer,
    imageStorage,
    generationRequestRepo,
    postRepo,
    brandProfileRepo,
    topicSuggestionRepo,
  )

  const internalSecret = process.env['INTERNAL_SECRET']
  if (!internalSecret) {
    throw new Error('INTERNAL_SECRET env var is required — set it before starting the generator service')
  }

  app.post('/generate', async (request, reply) => {
    const header = request.headers['x-internal-secret']
    if (header !== internalSecret) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    const parsed = generateSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid request body', details: parsed.error.flatten() })
    }

    try {
      const generationRequest = await useCase.execute({
        userId: parsed.data.brandId,
        brandId: parsed.data.brandId,
        description: parsed.data.description,
        textContent: parsed.data.textContent ?? null,
        imageStoragePaths: parsed.data.imageStoragePaths ?? [],
        targetPlatforms: parsed.data.targetPlatforms,
        artifactCount: parsed.data.artifactCount,
        topicSuggestionId: parsed.data.topicSuggestionId ?? null,
        style: parsed.data.style,
        aspectRatio: parsed.data.aspectRatio,
      })
      return reply.send({ generationRequest })
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      app.log.error({ err }, 'generate content use-case failed')
      return reply.status(500).send({ error: 'Internal error', detail })
    }
  })

  app.get('/generation-requests/:id', async (request, reply) => {
    const header = request.headers['x-internal-secret']
    if (header !== internalSecret) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    const { id } = request.params as { id: string }
    const generationRequest = await generationRequestRepo.findById(id)
    if (!generationRequest) {
      return reply.status(404).send({ error: 'Generation request not found' })
    }
    return reply.send({ generationRequest })
  })

  app.get('/images/signed-url', async (request, reply) => {
    const header = request.headers['x-internal-secret']
    if (header !== internalSecret) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    const parsed = z.object({ path: z.string().min(1) }).safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid query', details: parsed.error.flatten() })
    }

    try {
      const url = await imageStorage.getSignedUrl(parsed.data.path, 3600)
      return reply.send({ url })
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      app.log.error({ err }, 'getSignedUrl failed')
      return reply.status(500).send({ error: 'Internal error', detail })
    }
  })
}
