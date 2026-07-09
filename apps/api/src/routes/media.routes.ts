import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { fetchInternal } from '../lib/serviceAuth.js'

const querySchema = z.object({ path: z.string().min(1) })

// Proxy público e não-autenticado (de propósito): o TikTok busca o vídeo diretamente
// via PULL_FROM_URL (_local-adr-policy-035), sem sessão de usuário. O único guarda é o
// prefixo obrigatório "videos/" — não é um proxy aberto para qualquer objeto do bucket.
export async function mediaRoutes(app: FastifyInstance) {
  const generatorUrl = process.env['GENERATOR_URL'] ?? 'http://localhost:3003'
  const internalSecret = process.env['INTERNAL_SECRET'] ?? ''

  app.get('/media/tiktok-video', async (request, reply) => {
    const parsed = querySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid query' })
    }

    const { path } = parsed.data
    if (!path.startsWith('videos/')) {
      return reply.status(400).send({ error: 'Invalid path' })
    }

    const signedUrlRes = await fetchInternal(
      `${generatorUrl}/videos/signed-url?path=${encodeURIComponent(path)}`,
      { headers: { 'X-Internal-Secret': internalSecret } },
    )

    if (!signedUrlRes.ok) {
      return reply.status(404).send({ error: 'Video not found' })
    }

    const { url } = (await signedUrlRes.json()) as { url: string }
    const videoRes = await fetch(url)

    if (!videoRes.ok || !videoRes.body) {
      return reply.status(502).send({ error: 'Failed to fetch video' })
    }

    reply.header('Content-Type', videoRes.headers.get('content-type') ?? 'video/mp4')
    const contentLength = videoRes.headers.get('content-length')
    if (contentLength) reply.header('Content-Length', contentLength)

    return reply.send(videoRes.body)
  })
}
