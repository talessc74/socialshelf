import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { fetchInternal } from '../lib/serviceAuth.js'

const searchSchema = z.object({ query: z.string().min(1) })

export async function pautaRoutes(app: FastifyInstance) {
  const generatorUrl = process.env['GENERATOR_URL'] ?? 'http://localhost:3003'
  const internalSecret = process.env['INTERNAL_SECRET'] ?? ''

  app.get(
    '/pauta-suggestions',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const res = await fetchInternal(`${generatorUrl}/pauta/suggest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Secret': internalSecret,
        },
        body: JSON.stringify({ brandId: request.userId }),
      })

      if (!res.ok) {
        const body = await res.text()
        if (res.status === 404) return reply.status(404).send({ error: 'No brand profile for this brand' })
        app.log.error(`Generator error ${res.status}: ${body}`)
        return reply.status(502).send({ error: 'Generator error', detail: body })
      }

      return reply.send(await res.json())
    },
  )

  app.post(
    '/pauta-search',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const parsed = searchSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid request body', details: parsed.error.flatten() })
      }

      const res = await fetchInternal(`${generatorUrl}/pauta/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Secret': internalSecret,
        },
        body: JSON.stringify({ brandId: request.userId, query: parsed.data.query }),
      })

      if (!res.ok) {
        const body = await res.text()
        if (res.status === 404) return reply.status(404).send({ error: 'No brand profile for this brand' })
        app.log.error(`Generator error ${res.status}: ${body}`)
        return reply.status(502).send({ error: 'Generator error', detail: body })
      }

      return reply.send(await res.json())
    },
  )
}
