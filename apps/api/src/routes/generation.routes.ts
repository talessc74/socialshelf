import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { Platform } from '@socialshelf/domain'
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
