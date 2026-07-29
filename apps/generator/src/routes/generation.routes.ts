import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { Platform, TemplateStyle, AspectRatio, MAX_GENERATION_ARTIFACTS } from '@socialshelf/domain'
import { GenerateContentUseCase } from '../use-cases/GenerateContentUseCase.js'
import { EditArtifactUseCase } from '../use-cases/EditArtifactUseCase.js'
import { RenderCardUseCase } from '../use-cases/RenderCardUseCase.js'
import { EditArtifactTextUseCase } from '../use-cases/EditArtifactTextUseCase.js'
import { GeminiCopyGenerator } from '../infrastructure/vertexai/GeminiCopyGenerator.js'
import { GeminiArtDirector } from '../infrastructure/vertexai/GeminiArtDirector.js'
import { ImagenImageGenerator } from '../infrastructure/vertexai/ImagenImageGenerator.js'
import { SharpTemplateRenderer } from '../infrastructure/template/SharpTemplateRenderer.js'
import { GcsImageStorage } from '../infrastructure/storage/GcsImageStorage.js'
import { FirestoreGenerationRequestRepository } from '../infrastructure/firestore/FirestoreGenerationRequestRepository.js'
import { FirestorePostRepository } from '../infrastructure/firestore/FirestorePostRepository.js'
import { FirestoreBrandProfileRepository } from '../infrastructure/firestore/FirestoreBrandProfileRepository.js'
import { FirestoreTopicSuggestionRepository } from '../infrastructure/firestore/FirestoreTopicSuggestionRepository.js'
import { FirestoreAiUsageRepository } from '../infrastructure/firestore/FirestoreAiUsageRepository.js'
import { computePerceptualHash } from '../lib/perceptualHash.js'
import { computeAspectRatio } from '../lib/imageAspectRatio.js'

const platformEnum = z.enum([
  Platform.LINKEDIN,
  Platform.FACEBOOK,
  Platform.INSTAGRAM,
  Platform.TWITTER,
  Platform.TIKTOK,
])

const generateSchema = z.object({
  brandId: z.string().min(1),
  description: z.string().min(1),
  textContent: z.string().min(1).optional(),
  // Teto real do carrossel do Instagram via Graph API (packages/domain/entities/Platform.ts)
  // — o cliente já desabilita o upload além disso, mas o backend não deve confiar só na UI.
  imageStoragePaths: z.array(z.string()).max(MAX_GENERATION_ARTIFACTS).optional(),
  targetPlatforms: z.array(platformEnum).min(1),
  topicSuggestionId: z.string().min(1).optional(),
  style: z.nativeEnum(TemplateStyle).default(TemplateStyle.BOLD_BOTTOM),
  aspectRatio: z.nativeEnum(AspectRatio).default(AspectRatio.SQUARE),
  includeBodyText: z.boolean().default(false),
  // 'autonomy-tick' só é enviado pelo tick de autonomia do publisher-service — qualquer
  // chamada vinda da UI (via api-service) nunca envia isso, então o default cobre o caso real.
  origin: z.enum(['manual', 'autonomy-tick']).default('manual'),
})

const editArtifactSchema = z.object({
  instruction: z.string().min(1),
})

const editArtifactTextSchema = z.object({
  headline: z.string().min(1),
  body: z.string().nullable(),
})

const uploadImageSchema = z.object({
  userId: z.string().min(1),
  brandId: z.string().min(1),
  base64: z.string().min(1),
  mimeType: z.string().min(1),
  // Só o upload de foto de campanha pede o hash perceptual (detecção de quase-iguais). O upload
  // manual de geração não liga o flag, então não paga o custo do decode extra.
  perceptualHash: z.boolean().default(false),
})

const deleteImageSchema = z.object({
  path: z.string().min(1),
})

const renderCardSchema = z.object({
  userId: z.string().min(1),
  brandId: z.string().min(1),
  imageStoragePath: z.string().min(1),
  headline: z.string().default(''),
  body: z.string().nullable().default(null),
  style: z.nativeEnum(TemplateStyle),
})

export async function generationRoutes(app: FastifyInstance) {
  const projectId = process.env['GCP_PROJECT_ID'] ?? ''
  const location = process.env['VERTEX_AI_LOCATION'] ?? 'us-central1'
  const geminiLocation = process.env['GEMINI_LOCATION'] ?? 'global'
  const geminiModel = process.env['GEMINI_MODEL'] ?? 'gemini-2.5-flash'
  const imagenModel = process.env['IMAGEN_MODEL'] ?? 'imagen-4.0-generate-001'
  const generatedBucket = process.env['GCS_BUCKET_GENERATED'] ?? ''

  const aiUsageRepo = new FirestoreAiUsageRepository()
  const copyGenerator = new GeminiCopyGenerator(projectId, geminiLocation, geminiModel, aiUsageRepo)
  const artDirector = new GeminiArtDirector(projectId, geminiLocation, geminiModel, aiUsageRepo)
  const imageGenerator = new ImagenImageGenerator(projectId, location, imagenModel, aiUsageRepo)
  const templateRenderer = new SharpTemplateRenderer()
  const imageStorage = new GcsImageStorage(generatedBucket)
  const generationRequestRepo = new FirestoreGenerationRequestRepository()
  const postRepo = new FirestorePostRepository()
  const brandProfileRepo = new FirestoreBrandProfileRepository()
  const topicSuggestionRepo = new FirestoreTopicSuggestionRepository()

  const useCase = new GenerateContentUseCase(
    copyGenerator,
    artDirector,
    imageGenerator,
    templateRenderer,
    imageStorage,
    generationRequestRepo,
    postRepo,
    brandProfileRepo,
    topicSuggestionRepo,
  )

  const editArtifactUseCase = new EditArtifactUseCase(
    imageGenerator,
    templateRenderer,
    imageStorage,
    generationRequestRepo,
    brandProfileRepo,
  )

  const renderCardUseCase = new RenderCardUseCase(templateRenderer, imageStorage, brandProfileRepo)
  const editArtifactTextUseCase = new EditArtifactTextUseCase(
    templateRenderer,
    imageStorage,
    generationRequestRepo,
    brandProfileRepo,
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
        topicSuggestionId: parsed.data.topicSuggestionId ?? null,
        style: parsed.data.style,
        aspectRatio: parsed.data.aspectRatio,
        includeBodyText: parsed.data.includeBodyText,
        origin: parsed.data.origin,
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

  app.post('/generation-requests/:id/artifacts/:position/edit', async (request, reply) => {
    const header = request.headers['x-internal-secret']
    if (header !== internalSecret) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    const { id, position } = request.params as { id: string; position: string }
    const parsed = editArtifactSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid request body', details: parsed.error.flatten() })
    }

    try {
      const generationRequest = await editArtifactUseCase.execute({
        generationRequestId: id,
        position: Number(position),
        instruction: parsed.data.instruction,
      })
      return reply.send({ generationRequest })
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      app.log.error({ err }, 'edit artifact use-case failed')
      const status = detail.includes('not found') ? 404 : 500
      return reply.status(status).send({ error: 'Internal error', detail })
    }
  })

  app.post('/generation-requests/:id/artifacts/:position/edit-text', async (request, reply) => {
    const header = request.headers['x-internal-secret']
    if (header !== internalSecret) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    const { id, position } = request.params as { id: string; position: string }
    const parsed = editArtifactTextSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid request body', details: parsed.error.flatten() })
    }

    try {
      const generationRequest = await editArtifactTextUseCase.execute({
        generationRequestId: id,
        position: Number(position),
        headline: parsed.data.headline,
        body: parsed.data.body,
      })
      return reply.send({ generationRequest })
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      app.log.error({ err }, 'edit artifact text use-case failed')
      const status = detail.includes('not found') ? 404 : detail.includes('does not support') ? 422 : 500
      return reply.status(status).send({ error: 'Internal error', detail })
    }
  })

  app.post('/images/upload', async (request, reply) => {
    const header = request.headers['x-internal-secret']
    if (header !== internalSecret) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    const parsed = uploadImageSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid request body', details: parsed.error.flatten() })
    }

    try {
      const buffer = Buffer.from(parsed.data.base64, 'base64')
      // aspectRatio anda junto do mesmo flag de perceptualHash — hoje só o upload de foto de
      // campanha (que também detecta quase-iguais) precisa de qualquer um dos dois.
      const [path, perceptualHash, aspectRatio] = await Promise.all([
        imageStorage.upload(parsed.data.userId, parsed.data.brandId, buffer, parsed.data.mimeType, 'upload'),
        parsed.data.perceptualHash ? computePerceptualHash(buffer) : Promise.resolve(null),
        parsed.data.perceptualHash ? computeAspectRatio(buffer) : Promise.resolve(null),
      ])
      return reply.send({ path, perceptualHash, aspectRatio })
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      app.log.error({ err }, 'image upload failed')
      return reply.status(500).send({ error: 'Internal error', detail })
    }
  })

  app.post('/images/delete', async (request, reply) => {
    const header = request.headers['x-internal-secret']
    if (header !== internalSecret) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    const parsed = deleteImageSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid request body', details: parsed.error.flatten() })
    }

    try {
      await imageStorage.delete(parsed.data.path)
      return reply.send({ success: true })
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      app.log.error({ err }, 'image delete failed')
      return reply.status(500).send({ error: 'Internal error', detail })
    }
  })

  app.post('/cards/render', async (request, reply) => {
    const header = request.headers['x-internal-secret']
    if (header !== internalSecret) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    const parsed = renderCardSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid request body', details: parsed.error.flatten() })
    }

    try {
      const result = await renderCardUseCase.execute(parsed.data)
      return reply.send(result)
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      app.log.error({ err }, 'render card use-case failed')
      return reply.status(500).send({ error: 'Internal error', detail })
    }
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

  // Uma requisição por foto pra resolver miniatura explode o rate limit global do api-service
  // (100/min) em telas com muitas imagens de uma vez, como a grade de upload de campanha
  // (ver _local-edr-policy-039) — este endpoint resolve todos os paths de uma tela em uma
  // única chamada. Assinar uma URL é uma operação criptográfica local (chave da service
  // account), sem round-trip de rede por item, então o lote inteiro é barato.
  app.post('/images/signed-urls', async (request, reply) => {
    const header = request.headers['x-internal-secret']
    if (header !== internalSecret) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    const parsed = z.object({ paths: z.array(z.string().min(1)).min(1).max(500) }).safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid request body', details: parsed.error.flatten() })
    }

    try {
      const entries = await Promise.all(
        parsed.data.paths.map(async (path) => [path, await imageStorage.getSignedUrl(path, 3600)] as const),
      )
      return reply.send({ urls: Object.fromEntries(entries) })
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      app.log.error({ err }, 'batch getSignedUrl failed')
      return reply.status(500).send({ error: 'Internal error', detail })
    }
  })
}
