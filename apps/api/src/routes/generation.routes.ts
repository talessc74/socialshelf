import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { Platform, TemplateStyle, AspectRatio } from '@socialshelf/domain'
import { fetchInternal } from '../lib/serviceAuth.js'

const platformEnum = z.enum([
  Platform.LINKEDIN,
  Platform.FACEBOOK,
  Platform.INSTAGRAM,
  Platform.TWITTER,
])

const generateSchema = z.object({
  description: z.string().min(1),
  textContent: z.string().min(1).optional(),
  imageStoragePaths: z.array(z.string()).optional(),
  targetPlatforms: z.array(platformEnum).min(1),
  artifactCount: z.number().int().min(1).max(10).optional(),
  topicSuggestionId: z.string().min(1).optional(),
  style: z.nativeEnum(TemplateStyle).optional(),
  aspectRatio: z.nativeEnum(AspectRatio).optional(),
})

const editArtifactSchema = z.object({
  instruction: z.string().min(1),
})

export async function generationRoutes(app: FastifyInstance) {
  const generatorUrl = process.env['GENERATOR_URL'] ?? 'http://localhost:3003'
  const internalSecret = process.env['INTERNAL_SECRET'] ?? ''

  app.post(
    '/generation-requests',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const parsed = generateSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid request body', details: parsed.error.flatten() })
      }

      const res = await fetchInternal(`${generatorUrl}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Secret': internalSecret,
        },
        body: JSON.stringify({ brandId: request.userId, ...parsed.data }),
      })

      if (!res.ok) {
        const body = await res.text()
        app.log.error(`Generator error ${res.status}: ${body}`)
        return reply.status(502).send({ error: 'Generator error', detail: body })
      }

      return reply.send(await res.json())
    },
  )

  app.get(
    '/generation-requests/:id',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string }

      const res = await fetchInternal(`${generatorUrl}/generation-requests/${id}`, {
        headers: { 'X-Internal-Secret': internalSecret },
      })

      if (!res.ok) {
        const body = await res.text()
        if (res.status === 404) return reply.status(404).send({ error: 'Generation request not found' })
        app.log.error(`Generator error ${res.status}: ${body}`)
        return reply.status(502).send({ error: 'Generator error', detail: body })
      }

      return reply.send(await res.json())
    },
  )

  app.post(
    '/generation-requests/:id/artifacts/:position/edit',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id, position } = request.params as { id: string; position: string }
      const parsed = editArtifactSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid request body', details: parsed.error.flatten() })
      }

      const res = await fetchInternal(
        `${generatorUrl}/generation-requests/${id}/artifacts/${position}/edit`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Internal-Secret': internalSecret,
          },
          body: JSON.stringify(parsed.data),
        },
      )

      if (!res.ok) {
        const body = await res.text()
        if (res.status === 404) return reply.status(404).send({ error: 'Generation request or artifact not found' })
        app.log.error(`Generator error ${res.status}: ${body}`)
        return reply.status(502).send({ error: 'Generator error', detail: body })
      }

      return reply.send(await res.json())
    },
  )

  app.post(
    '/images/upload',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const file = await request.file()
      if (!file) {
        return reply.status(400).send({ error: 'No file provided' })
      }
      const allowedMimeTypes = ['image/png', 'image/jpeg', 'image/webp']
      if (!allowedMimeTypes.includes(file.mimetype)) {
        return reply.status(400).send({ error: 'Unsupported image type' })
      }

      const buffer = await file.toBuffer()
      const res = await fetchInternal(`${generatorUrl}/images/upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Secret': internalSecret,
        },
        body: JSON.stringify({
          userId: request.userId,
          brandId: request.userId,
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

  app.get(
    '/generation-images/signed-url',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const parsed = z.object({ path: z.string().min(1) }).safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid query', details: parsed.error.flatten() })
      }

      if (!parsed.data.path.startsWith(`${request.userId}/`)) {
        return reply.status(403).send({ error: 'Forbidden' })
      }

      const res = await fetchInternal(
        `${generatorUrl}/images/signed-url?path=${encodeURIComponent(parsed.data.path)}`,
        { headers: { 'X-Internal-Secret': internalSecret } },
      )

      if (!res.ok) {
        const body = await res.text()
        app.log.error(`Generator error ${res.status}: ${body}`)
        return reply.status(502).send({ error: 'Generator error', detail: body })
      }

      return reply.send(await res.json())
    },
  )
}
