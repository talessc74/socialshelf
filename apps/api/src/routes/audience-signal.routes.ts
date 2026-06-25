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

const querySchema = z.object({ platform: platformEnum })

export async function audienceSignalRoutes(app: FastifyInstance) {
  const publisherUrl = process.env['PUBLISHER_URL'] ?? 'http://localhost:3002'
  const internalSecret = process.env['INTERNAL_SECRET'] ?? ''

  app.get(
    '/audience-signal',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const parsed = querySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid query params', details: parsed.error.flatten() })
      }

      const res = await fetchInternal(`${publisherUrl}/audience-signal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Secret': internalSecret,
        },
        body: JSON.stringify({ brandId: request.brandId, platform: parsed.data.platform }),
      })

      if (!res.ok) {
        const body = await res.text()
        if (res.status === 404) return reply.status(404).send({ error: 'No OAuth connection for platform' })
        app.log.error(`Publisher error ${res.status}: ${body}`)
        return reply.status(502).send({ error: 'Publisher error', detail: body })
      }

      return reply.send(await res.json())
    },
  )
}
