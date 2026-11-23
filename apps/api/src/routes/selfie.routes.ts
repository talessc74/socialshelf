import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { Platform, ALL_PLATFORMS } from '@socialshelf/domain'
import { FirestoreOAuthRepository } from '../infrastructure/firestore/FirestoreOAuthRepository.js'
import { fetchInternal } from '../lib/serviceAuth.js'

const bodySchema = z.object({
  question: z.string().min(1).max(1000),
  history: z
    .array(z.object({ role: z.enum(['user', 'selfie']), text: z.string().max(2000) }))
    .max(10)
    .default([]),
})

export async function selfieRoutes(app: FastifyInstance) {
  const oauthRepo = new FirestoreOAuthRepository()
  const generatorUrl = process.env['GENERATOR_URL'] ?? 'http://localhost:3003'
  const internalSecret = process.env['INTERNAL_SECRET'] ?? ''

  app.post('/selfie/ask', { preHandler: [app.authenticate] }, async (request, reply) => {
    const parsed = bodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid request body', details: parsed.error.flatten() })
    }

    // Monta o resumo de conexão a partir do OAuthRepository real — nunca confia em estado que
    // o cliente mandaria sozinho (_local-adr-policy-045).
    const connections = await oauthRepo.findByBrand(request.userId, request.brandId)
    const connectionByPlatform = new Map(connections.map((c) => [c.platform, c]))
    const accountStatus = ALL_PLATFORMS.map((platform: Platform) => {
      const connection = connectionByPlatform.get(platform)
      return {
        platform,
        connected: Boolean(connection),
        accountLabel: connection?.accountLabel ?? null,
        connectionLikelyExpired: Boolean(connection?.expiresAt && connection.expiresAt.getTime() <= Date.now()),
      }
    })

    const res = await fetchInternal(`${generatorUrl}/selfie/ask`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Secret': internalSecret,
      },
      body: JSON.stringify({
        userId: request.userId,
        brandId: request.brandId,
        question: parsed.data.question,
        history: parsed.data.history,
        accountStatus,
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      app.log.error(`Generator error ${res.status}: ${body}`)
      return reply.status(502).send({ error: 'Generator error', detail: body })
    }

    return reply.send(await res.json())
  })
}
