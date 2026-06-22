import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { CreateBrandProfileVersionUseCase } from '../use-cases/brand-profile/CreateBrandProfileVersionUseCase.js'
import { FirestoreBrandProfileRepository } from '../infrastructure/firestore/FirestoreBrandProfileRepository.js'
import { fetchInternal } from '../lib/serviceAuth.js'

const autonomyLevelEnum = z.enum(['manual', 'semi-automatic', 'automatic'])

const brandProfileSchema = z.object({
  business: z.object({
    name: z.string().min(1),
    segment: z.string().min(1),
    description: z.string(),
  }),
  identity: z.object({
    positioning: z.string(),
    values: z.array(z.string()),
  }),
  visual: z.object({
    primaryColor: z.string().min(1),
    secondaryColor: z.string().min(1),
    typography: z.string(),
    logoStoragePath: z.string().nullable(),
  }),
  voice: z.object({
    tone: z.string(),
    allowedVocabulary: z.array(z.string()),
    prohibitedVocabulary: z.array(z.string()),
  }),
  narrative: z.object({
    recurringThemes: z.array(z.string()),
  }),
  operation: z.object({
    autonomyLevel: autonomyLevelEnum,
    autoPublishTopics: z.array(z.string()),
    blockedTopics: z.array(z.string()),
  }),
})

export async function brandProfileRoutes(app: FastifyInstance) {
  const brandProfileRepo = new FirestoreBrandProfileRepository()
  const createBrandProfileVersion = new CreateBrandProfileVersionUseCase(brandProfileRepo)
  const generatorUrl = process.env['GENERATOR_URL'] ?? 'http://localhost:3003'
  const internalSecret = process.env['INTERNAL_SECRET'] ?? ''

  app.get(
    '/brand-profile',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const profile = await brandProfileRepo.findLatestByBrand(request.userId)
      return reply.send({ brandProfile: profile })
    },
  )

  app.put(
    '/brand-profile',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const parsed = brandProfileSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Invalid request body',
          details: parsed.error.flatten(),
        })
      }

      const profile = await createBrandProfileVersion.execute({
        userId: request.userId,
        brandId: request.userId,
        ...parsed.data,
      })

      return reply.status(201).send({ brandProfile: profile })
    },
  )

  app.post(
    '/brand-profile/document',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const file = await request.file()
      if (!file) {
        return reply.status(400).send({ error: 'No file provided' })
      }
      const allowedMimeTypes = ['application/pdf', 'text/plain']
      if (!allowedMimeTypes.includes(file.mimetype)) {
        return reply.status(400).send({ error: 'Unsupported document type' })
      }

      const buffer = await file.toBuffer()
      const res = await fetchInternal(`${generatorUrl}/brand-profile/extract`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Secret': internalSecret,
        },
        body: JSON.stringify({
          base64: buffer.toString('base64'),
          mimeType: file.mimetype,
        }),
      })

      if (!res.ok) {
        const body = await res.text()
        app.log.error(`Generator error ${res.status}: ${body}`)
        return reply.status(502).send({ error: 'Generator error', detail: body })
      }

      return reply.send(await res.json())
    },
  )
}
