import type { FastifyInstance } from 'fastify'

export async function performanceInsightsRoutes(app: FastifyInstance) {
  const publisherUrl = process.env['PUBLISHER_URL'] ?? 'http://localhost:3002'
  const generatorUrl = process.env['GENERATOR_URL'] ?? 'http://localhost:3003'
  const internalSecret = process.env['INTERNAL_SECRET'] ?? ''

  app.get(
    '/performance-insights',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const performanceRes = await fetch(`${publisherUrl}/posts-performance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Secret': internalSecret,
        },
        body: JSON.stringify({ brandId: request.userId }),
      })

      if (!performanceRes.ok) {
        const body = await performanceRes.text()
        app.log.error(`Publisher error ${performanceRes.status}: ${body}`)
        return reply.status(502).send({ error: 'Publisher error', detail: body })
      }

      const { entries } = (await performanceRes.json()) as { entries: unknown[] }

      const insightsRes = await fetch(`${generatorUrl}/performance-insights/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Secret': internalSecret,
        },
        body: JSON.stringify({ entries }),
      })

      if (!insightsRes.ok) {
        const body = await insightsRes.text()
        if (insightsRes.status === 400) return reply.status(400).send({ error: 'No published posts with metrics to analyze' })
        app.log.error(`Generator error ${insightsRes.status}: ${body}`)
        return reply.status(502).send({ error: 'Generator error', detail: body })
      }

      return reply.send(await insightsRes.json())
    },
  )
}
