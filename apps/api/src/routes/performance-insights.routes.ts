import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { Platform } from '@socialshelf/domain'
import { fetchInternal } from '../lib/serviceAuth.js'

const platformEnum = z.enum([Platform.LINKEDIN, Platform.FACEBOOK, Platform.INSTAGRAM, Platform.TWITTER])

const analyzeSchema = z.object({
  entries: z.array(
    z.object({
      platform: platformEnum,
      text: z.string(),
      metrics: z.object({
        impressions: z.number(),
        likes: z.number(),
        comments: z.number(),
        shares: z.number(),
      }),
      score: z.number(),
    }),
  ),
})

export async function performanceInsightsRoutes(app: FastifyInstance) {
  const generatorUrl = process.env['GENERATOR_URL'] ?? 'http://localhost:3003'
  const internalSecret = process.env['INTERNAL_SECRET'] ?? ''

  // Recebe as entradas que a tela já buscou via GET /posts-performance em vez de buscar de
  // novo no publisher — evita uma segunda rodada de chamadas ao vivo para Meta/X/LinkedIn a
  // cada carregamento da tela de Performance (_local-edr-policy-040).
  app.post(
    '/performance-insights',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const parsed = analyzeSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid request body', details: parsed.error.flatten() })
      }

      const insightsRes = await fetchInternal(`${generatorUrl}/performance-insights/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Secret': internalSecret,
        },
        body: JSON.stringify({ brandId: request.brandId, entries: parsed.data.entries }),
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

  app.get(
    '/performance-insights/latest',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const res = await fetchInternal(
        `${generatorUrl}/performance-insights/latest?brandId=${encodeURIComponent(request.brandId)}`,
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
