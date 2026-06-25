import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { Platform } from '@socialshelf/domain'
import { fetchInternal } from '../lib/serviceAuth.js'
import { FirestorePostRepository } from '../infrastructure/firestore/FirestorePostRepository.js'

const searchSchema = z.object({ query: z.string().min(1) })

interface RawTopicSuggestion {
  articleUrl: string
  [key: string]: unknown
}

export async function pautaRoutes(app: FastifyInstance) {
  const generatorUrl = process.env['GENERATOR_URL'] ?? 'http://localhost:3003'
  const internalSecret = process.env['INTERNAL_SECRET'] ?? ''
  const postRepo = new FirestorePostRepository()

  // Anexa, a cada sugestão, em quais redes a notícia (pelo articleUrl) já gerou um post publicado —
  // permite à UI marcar "essa notícia já foi usada" sem o gerador precisar conhecer posts.
  async function attachPublishedPlatforms(brandId: string, suggestions: RawTopicSuggestion[]) {
    const publishedPosts = await postRepo.findByBrand(brandId, 'published')
    const platformsByArticleUrl = new Map<string, Set<Platform>>()
    for (const post of publishedPosts) {
      if (!post.sourceArticleUrl) continue
      const platforms = platformsByArticleUrl.get(post.sourceArticleUrl) ?? new Set<Platform>()
      for (const c of post.content) platforms.add(c.platform)
      platformsByArticleUrl.set(post.sourceArticleUrl, platforms)
    }
    return suggestions.map((s) => ({
      ...s,
      publishedPlatforms: [...(platformsByArticleUrl.get(s.articleUrl) ?? [])],
    }))
  }

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

      const body = (await res.json()) as { suggestions: RawTopicSuggestion[] }
      const suggestions = await attachPublishedPlatforms(request.userId, body.suggestions)
      return reply.send({ suggestions })
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

      const body = (await res.json()) as { suggestions: RawTopicSuggestion[] }
      const suggestions = await attachPublishedPlatforms(request.userId, body.suggestions)
      return reply.send({ suggestions })
    },
  )
}
