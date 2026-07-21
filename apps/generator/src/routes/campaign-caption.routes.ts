import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { GeminiCampaignCaptionWriter } from '../infrastructure/vertexai/GeminiCampaignCaptionWriter.js'
import { GcsImageStorage } from '../infrastructure/storage/GcsImageStorage.js'
import { FirestoreBrandProfileRepository } from '../infrastructure/firestore/FirestoreBrandProfileRepository.js'

const captionSuggestionSchema = z.object({
  brandId: z.string().min(1),
  userId: z.string().min(1),
  storagePath: z.string().min(1),
  campaignName: z.string().min(1),
  campaignDescription: z.string(),
  keywords: z.array(z.string()),
  // Tolerante a chamadas antigas que ainda não mandam accountType/metadados: default professional
  // (comportamento anterior) e metadados vazios, pra não quebrar durante o rollout.
  accountType: z.enum(['personal', 'professional']).default('professional'),
  photoTakenAt: z.string().datetime().nullish(),
  photoHasLocation: z.boolean().default(false),
  photoCount: z.number().int().min(1).default(1),
})

// Usado por GenerateCampaignTimelineUseCase (apps/api) para escrever a legenda de cada item
// de campanha olhando a foto de capa daquele item — nunca chamado pelo fluxo manual de
// geração de post (_local-edr-policy-039, legenda automática via IA).
export async function campaignCaptionRoutes(app: FastifyInstance) {
  const projectId = process.env['GCP_PROJECT_ID'] ?? ''
  const geminiLocation = process.env['GEMINI_LOCATION'] ?? 'global'
  const geminiModel = process.env['GEMINI_MODEL'] ?? 'gemini-2.5-flash'
  const generatedBucket = process.env['GCS_BUCKET_GENERATED'] ?? ''
  const internalSecret = process.env['INTERNAL_SECRET']

  if (!internalSecret) {
    throw new Error('INTERNAL_SECRET env var is required — set it before starting the generator service')
  }

  const captionWriter = new GeminiCampaignCaptionWriter(projectId, geminiLocation, geminiModel)
  const imageStorage = new GcsImageStorage(generatedBucket)
  const brandProfileRepo = new FirestoreBrandProfileRepository()

  app.post('/campaigns/caption-suggestion', async (request, reply) => {
    const header = request.headers['x-internal-secret']
    if (header !== internalSecret) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    const parsed = captionSuggestionSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid request body', details: parsed.error.flatten() })
    }

    try {
      const { userId, brandId, storagePath, campaignName, campaignDescription, keywords, accountType, photoTakenAt, photoHasLocation, photoCount } =
        parsed.data
      const [brandProfile, coverImage] = await Promise.all([
        brandProfileRepo.findLatestByBrand(userId, brandId),
        imageStorage.download(storagePath),
      ])

      const result = await captionWriter.write({
        coverImage,
        campaignName,
        campaignDescription,
        keywords,
        brandBusiness: brandProfile?.business ?? null,
        brandVoice: brandProfile?.voice ?? null,
        accountType,
        photoTakenAt: photoTakenAt ? new Date(photoTakenAt) : null,
        photoHasLocation,
        photoCount,
      })

      return reply.send(result)
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      app.log.error({ err }, 'campaign caption suggestion failed')
      return reply.status(500).send({ error: 'Internal error', detail })
    }
  })
}
