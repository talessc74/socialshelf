import type { FastifyInstance } from 'fastify'
import { fetchInternal } from '../lib/serviceAuth.js'

export async function performanceSuggestionsRoutes(app: FastifyInstance) {
  const publisherUrl = process.env['PUBLISHER_URL'] ?? 'http://localhost:3002'
  const generatorUrl = process.env['GENERATOR_URL'] ?? 'http://localhost:3003'
  const internalSecret = process.env['INTERNAL_SECRET'] ?? ''

  app.get(
    '/performance-suggestions',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const performanceRes = await fetchInternal(`${publisherUrl}/posts-performance`, {
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

      const insightsRes = await fetchInternal(`${generatorUrl}/performance-insights/analyze`, {
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

      const { insights } = (await insightsRes.json()) as { insights: unknown }

      const suggestionsRes = await fetchInternal(`${generatorUrl}/performance-suggestions/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Secret': internalSecret,
        },
        body: JSON.stringify({ brandId: request.userId, diagnostic: insights }),
      })

      if (!suggestionsRes.ok) {
        const body = await suggestionsRes.text()
        app.log.error(`Generator error ${suggestionsRes.status}: ${body}`)
        return reply.status(502).send({ error: 'Generator error', detail: body })
      }

      return reply.send(await suggestionsRes.json())
    },
  )

  app.post(
    '/performance-suggestions/:id/feedback',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const res = await fetchInternal(`${generatorUrl}/performance-suggestions/${id}/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Secret': internalSecret,
        },
        body: JSON.stringify({ brandId: request.userId, ...(request.body as object) }),
      })

      if (!res.ok) {
        const body = await res.text()
        app.log.error(`Generator error ${res.status}: ${body}`)
        return reply.status(502).send({ error: 'Generator error', detail: body })
      }

      return reply.send(await res.json())
    },
  )

  app.post(
    '/performance-suggestions/:id/shelve',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const res = await fetchInternal(`${generatorUrl}/performance-suggestions/${id}/shelve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Secret': internalSecret,
        },
        body: JSON.stringify({ brandId: request.userId, ...(request.body as object) }),
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
    '/performance-suggestions/shelved',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const res = await fetchInternal(
        `${generatorUrl}/performance-suggestions/shelved?brandId=${encodeURIComponent(request.userId)}`,
        {
          headers: { 'X-Internal-Secret': internalSecret },
        },
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
