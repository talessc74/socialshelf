import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { Platform } from '@socialshelf/domain'
import { CreatePhotoCampaignUseCase } from '../use-cases/campaigns/CreatePhotoCampaignUseCase.js'
import { UploadCampaignPhotoUseCase } from '../use-cases/campaigns/UploadCampaignPhotoUseCase.js'
import { DeleteCampaignPhotoUseCase } from '../use-cases/campaigns/DeleteCampaignPhotoUseCase.js'
import { ReorderCampaignPhotosUseCase } from '../use-cases/campaigns/ReorderCampaignPhotosUseCase.js'
import { GenerateCampaignTimelineUseCase } from '../use-cases/campaigns/GenerateCampaignTimelineUseCase.js'
import { ExtendCampaignTimelineUseCase } from '../use-cases/campaigns/ExtendCampaignTimelineUseCase.js'
import { UpdateCampaignTimelineUseCase } from '../use-cases/campaigns/UpdateCampaignTimelineUseCase.js'
import { ActivateCampaignUseCase } from '../use-cases/campaigns/ActivateCampaignUseCase.js'
import { CancelCampaignUseCase } from '../use-cases/campaigns/CancelCampaignUseCase.js'
import { PauseCampaignUseCase } from '../use-cases/campaigns/PauseCampaignUseCase.js'
import { ResumeCampaignUseCase } from '../use-cases/campaigns/ResumeCampaignUseCase.js'
import { FirestorePhotoCampaignRepository } from '../infrastructure/firestore/FirestorePhotoCampaignRepository.js'
import { FirestoreCampaignPhotoRepository } from '../infrastructure/firestore/FirestoreCampaignPhotoRepository.js'
import { FirestoreCampaignItemRepository } from '../infrastructure/firestore/FirestoreCampaignItemRepository.js'
import { FirestorePostRepository } from '../infrastructure/firestore/FirestorePostRepository.js'
import { FirestoreBrandProfileRepository } from '../infrastructure/firestore/FirestoreBrandProfileRepository.js'
import { FirestoreBrandRepository } from '../infrastructure/firestore/FirestoreBrandRepository.js'
import { FirestoreCampaignTimelineLockRepository } from '../infrastructure/firestore/FirestoreCampaignTimelineLockRepository.js'
import { HttpCampaignCaptionClient } from '../infrastructure/generator/CampaignCaptionClient.js'

const platformEnum = z.enum([Platform.LINKEDIN, Platform.FACEBOOK, Platform.INSTAGRAM, Platform.TWITTER, Platform.TIKTOK])

const createCampaignSchema = z.object({
  name: z.string().min(1),
  description: z.string().default(''),
  keywords: z.array(z.string()).default([]),
  platforms: z.array(platformEnum).min(1),
  postsPerDay: z.number().int().min(1).max(10),
  carouselSizeDefault: z.number().int().min(1).max(20),
})

const reorderPhotosSchema = z.object({
  photoIds: z.array(z.string().min(1)).min(1),
})

const updateTimelineSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().min(1),
        order: z.number().int(),
        photoIds: z.array(z.string()).min(1),
        caption: z.string(),
        scheduledAt: z.string().datetime(),
      }),
    )
    .min(1),
})

// 404 pra campanha inexistente, 409 pra lock ocupado (o cliente pode tentar de novo em
// instantes), 422 pro resto (violação de regra de negócio, ex: status errado pra essa ação).
function statusForCampaignError(message: string): number {
  if (message === 'Campaign not found') return 404
  if (message.includes('already in progress')) return 409
  return 422
}

export async function campaignsRoutes(app: FastifyInstance) {
  const campaignRepo = new FirestorePhotoCampaignRepository()
  const photoRepo = new FirestoreCampaignPhotoRepository()
  const itemRepo = new FirestoreCampaignItemRepository()
  const postRepo = new FirestorePostRepository()
  const brandProfileRepo = new FirestoreBrandProfileRepository()
  const brandRepo = new FirestoreBrandRepository()
  const timelineLockRepo = new FirestoreCampaignTimelineLockRepository()

  const generatorUrl = process.env['GENERATOR_URL'] ?? 'http://localhost:3003'
  const internalSecret = process.env['INTERNAL_SECRET'] ?? ''

  const createCampaign = new CreatePhotoCampaignUseCase(campaignRepo)
  const uploadPhoto = new UploadCampaignPhotoUseCase(campaignRepo, photoRepo, generatorUrl, internalSecret)
  const deletePhoto = new DeleteCampaignPhotoUseCase(campaignRepo, photoRepo, generatorUrl, internalSecret)
  const reorderPhotos = new ReorderCampaignPhotosUseCase(campaignRepo, photoRepo)
  const captionClient = new HttpCampaignCaptionClient(generatorUrl, internalSecret)
  const generateTimeline = new GenerateCampaignTimelineUseCase(
    campaignRepo,
    photoRepo,
    itemRepo,
    captionClient,
    timelineLockRepo,
    brandRepo,
  )
  const extendTimeline = new ExtendCampaignTimelineUseCase(
    campaignRepo,
    photoRepo,
    itemRepo,
    postRepo,
    brandProfileRepo,
    captionClient,
    timelineLockRepo,
    brandRepo,
  )
  const updateTimeline = new UpdateCampaignTimelineUseCase(campaignRepo, itemRepo)
  const activateCampaign = new ActivateCampaignUseCase(
    campaignRepo,
    itemRepo,
    photoRepo,
    postRepo,
    brandProfileRepo,
    timelineLockRepo,
  )
  const cancelCampaign = new CancelCampaignUseCase(campaignRepo, itemRepo, postRepo)
  const pauseCampaign = new PauseCampaignUseCase(campaignRepo, itemRepo, postRepo, timelineLockRepo)
  const resumeCampaign = new ResumeCampaignUseCase(
    campaignRepo,
    itemRepo,
    photoRepo,
    postRepo,
    brandProfileRepo,
    timelineLockRepo,
  )

  app.post('/campaigns', { preHandler: [app.authenticate] }, async (request, reply) => {
    const parsed = createCampaignSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid request body', details: parsed.error.flatten() })
    }

    try {
      const campaign = await createCampaign.execute({
        userId: request.userId,
        brandId: request.brandId,
        ...parsed.data,
      })
      return reply.status(201).send({ campaign })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return reply.status(422).send({ error: message })
    }
  })

  app.get('/campaigns', { preHandler: [app.authenticate] }, async (request, reply) => {
    try {
      const campaigns = await campaignRepo.findByBrand(request.userId, request.brandId)
      // photoCount é o que diferencia, pro usuário, um rascunho vazio de um rascunho que já
      // tem fotos esperando a próxima etapa — sem isso a tela não tem como saber a diferença
      // e o botão de próximo passo (ex: "Subir fotos" vs "Continuar upload") fica errado.
      const withPhotoCount = await Promise.all(
        campaigns.map(async (campaign) => ({
          ...campaign,
          photoCount: await photoRepo.countByCampaign(request.userId, request.brandId, campaign.id),
        })),
      )
      return reply.send({ campaigns: withPhotoCount })
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      app.log.error({ err }, 'find campaigns failed')
      return reply.status(500).send({ error: 'Internal error', detail })
    }
  })

  app.get('/campaigns/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    try {
      const campaign = await campaignRepo.findByIdAndBrand(id, request.userId, request.brandId)
      if (!campaign) return reply.status(404).send({ error: 'Campaign not found' })
      return reply.send({ campaign })
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      app.log.error({ err }, 'find campaign failed')
      return reply.status(500).send({ error: 'Internal error', detail })
    }
  })

  app.get('/campaigns/:id/photos', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const campaign = await campaignRepo.findByIdAndBrand(id, request.userId, request.brandId)
    if (!campaign) return reply.status(404).send({ error: 'Campaign not found' })
    try {
      const photos = await photoRepo.findByCampaign(id)
      return reply.send({ photos })
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      app.log.error({ err }, 'find campaign photos failed')
      return reply.status(500).send({ error: 'Internal error', detail })
    }
  })

  app.get('/campaigns/:id/timeline', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const campaign = await campaignRepo.findByIdAndBrand(id, request.userId, request.brandId)
    if (!campaign) return reply.status(404).send({ error: 'Campaign not found' })
    try {
      const items = await itemRepo.findByCampaign(id)
      return reply.send({ items })
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      app.log.error({ err }, 'find campaign timeline failed')
      return reply.status(500).send({ error: 'Internal error', detail })
    }
  })

  // Upload de uma foto por requisição — o cliente faz o loop por arquivo, mesmo padrão já
  // usado para upload de imagem manual (ver apps/web input[multiple] em compose/generate).
  app.post('/campaigns/:id/photos', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const file = await request.file()
    if (!file) return reply.status(400).send({ error: 'No file provided' })

    const allowedMimeTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/heic']
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return reply.status(400).send({ error: 'Unsupported image type' })
    }

    const buffer = await file.toBuffer()

    try {
      const photo = await uploadPhoto.execute({
        userId: request.userId,
        brandId: request.brandId,
        campaignId: id,
        buffer,
        mimeType: file.mimetype,
      })
      return reply.status(201).send({ photo })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const status = message === 'Campaign not found' ? 404 : 502
      return reply.status(status).send({ error: message })
    }
  })

  app.delete('/campaigns/:id/photos/:photoId', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id, photoId } = request.params as { id: string; photoId: string }

    try {
      await deletePhoto.execute({ userId: request.userId, brandId: request.brandId, campaignId: id, photoId })
      return reply.status(204).send()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const status = message === 'Campaign not found' || message === 'Photo not found' ? 404 : 500
      return reply.status(status).send({ error: message })
    }
  })

  app.put('/campaigns/:id/photos/order', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const parsed = reorderPhotosSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid request body', details: parsed.error.flatten() })
    }

    try {
      await reorderPhotos.execute({
        userId: request.userId,
        brandId: request.brandId,
        campaignId: id,
        photoIds: parsed.data.photoIds,
      })
      return reply.status(204).send()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const status = message === 'Campaign not found' ? 404 : 422
      return reply.status(status).send({ error: message })
    }
  })

  app.post('/campaigns/:id/timeline/generate', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    try {
      const items = await generateTimeline.execute({
        userId: request.userId,
        brandId: request.brandId,
        campaignId: id,
      })
      return reply.send({ items })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return reply.status(statusForCampaignError(message)).send({ error: message })
    }
  })

  // Fotos enviadas depois que a linha do tempo já existia (reviewing ou active) — agenda só as
  // fotos novas, anexando itens sem tocar nos existentes (ver ExtendCampaignTimelineUseCase).
  app.post('/campaigns/:id/timeline/extend', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    try {
      const items = await extendTimeline.execute({
        userId: request.userId,
        brandId: request.brandId,
        campaignId: id,
      })
      return reply.send({ items })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return reply.status(statusForCampaignError(message)).send({ error: message })
    }
  })

  app.put('/campaigns/:id/timeline', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const parsed = updateTimelineSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid request body', details: parsed.error.flatten() })
    }

    try {
      const items = await updateTimeline.execute({
        userId: request.userId,
        brandId: request.brandId,
        campaignId: id,
        items: parsed.data.items.map((item) => ({ ...item, scheduledAt: new Date(item.scheduledAt) })),
      })
      return reply.send({ items })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const status = message === 'Campaign not found' ? 404 : 422
      return reply.status(status).send({ error: message })
    }
  })

  app.post('/campaigns/:id/activate', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    try {
      await activateCampaign.execute({ userId: request.userId, brandId: request.brandId, campaignId: id })
      const campaign = await campaignRepo.findByIdAndBrand(id, request.userId, request.brandId)
      return reply.send({ campaign })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return reply.status(statusForCampaignError(message)).send({ error: message })
    }
  })

  app.post('/campaigns/:id/cancel', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    try {
      await cancelCampaign.execute({ userId: request.userId, brandId: request.brandId, campaignId: id })
      const campaign = await campaignRepo.findByIdAndBrand(id, request.userId, request.brandId)
      return reply.send({ campaign })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return reply.status(statusForCampaignError(message)).send({ error: message })
    }
  })

  // Pausa uma campanha 'active': apaga os Posts ainda 'scheduled' (o publisher nunca mais os
  // vê) e devolve os itens correspondentes a 'planned', prontos pro Resume reagendar.
  app.post('/campaigns/:id/pause', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    try {
      await pauseCampaign.execute({ userId: request.userId, brandId: request.brandId, campaignId: id })
      const campaign = await campaignRepo.findByIdAndBrand(id, request.userId, request.brandId)
      return reply.send({ campaign })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return reply.status(statusForCampaignError(message)).send({ error: message })
    }
  })

  // Retoma uma campanha 'paused': rematerializa os itens pendentes com datas novas a partir de
  // agora (nunca a partir de onde a linha do tempo tinha parado) e volta a campanha pra 'active'.
  app.post('/campaigns/:id/resume', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    try {
      await resumeCampaign.execute({ userId: request.userId, brandId: request.brandId, campaignId: id })
      const campaign = await campaignRepo.findByIdAndBrand(id, request.userId, request.brandId)
      return reply.send({ campaign })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return reply.status(statusForCampaignError(message)).send({ error: message })
    }
  })
}
