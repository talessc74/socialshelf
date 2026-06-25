import type { FastifyInstance } from 'fastify'
import { fetchInternal } from '../lib/serviceAuth.js'

export async function postsPerformanceRoutes(app: FastifyInstance) {
  const publisherUrl = process.env['PUBLISHER_URL'] ?? 'http://localhost:3002'
  const internalSecret = process.env['INTERNAL_SECRET'] ?? ''

  app.get(
    '/posts-performance',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const res = await fetchInternal(`${publisherUrl}/posts-performance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Secret': internalSecret,
        },
        body: JSON.stringify({ brandId: request.brandId }),
      })

      if (!res.ok) {
        const body = await res.text()
        app.log.error(`Publisher error ${res.status}: ${body}`)
        return reply.status(502).send({ error: 'Publisher error', detail: body })
      }

      return reply.send(await res.json())
    },
  )
}
