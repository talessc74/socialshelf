import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { validateState } from '../../lib/csrf.js'
import { GenerateTikTokAuthUrlUseCase } from '../../use-cases/oauth/GenerateTikTokAuthUrlUseCase.js'
import { HandleTikTokCallbackUseCase } from '../../use-cases/oauth/HandleTikTokCallbackUseCase.js'
import { FirestoreOAuthRepository } from '../../infrastructure/firestore/FirestoreOAuthRepository.js'
import { FirestoreTokenVault } from '../../infrastructure/firestore/FirestoreTokenVault.js'

const callbackQuerySchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
})

export async function tiktokOAuthRoutes(app: FastifyInstance) {
  const oauthRepo = new FirestoreOAuthRepository()
  const tokenVault = new FirestoreTokenVault()
  const generateUrl = new GenerateTikTokAuthUrlUseCase()
  const handleCallback = new HandleTikTokCallbackUseCase(oauthRepo, tokenVault)

  const webUrl = process.env['WEB_URL'] ?? 'http://localhost:3000'

  app.get(
    '/oauth/tiktok/authorize',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { url } = generateUrl.execute(request.userId, request.brandId)
      return reply.send({ url })
    },
  )

  app.get('/oauth/tiktok/callback', async (request, reply) => {
    const result = callbackQuerySchema.safeParse(request.query)
    if (!result.success) {
      return reply.status(400).send({ error: 'Invalid callback parameters' })
    }

    const { code, state } = result.data

    let userId: string
    let brandId: string
    let codeVerifier: string

    try {
      const validated = validateState(state)
      userId = validated.userId
      brandId = validated.brandId
      if (!validated.codeVerifier) {
        app.log.error('codeVerifier missing from state')
        return reply.redirect(`${webUrl}/dashboard?error=oauth_failed&detail=no_verifier`)
      }
      codeVerifier = validated.codeVerifier
    } catch (err) {
      app.log.error({ err }, 'state validation failed')
      return reply.redirect(`${webUrl}/dashboard?error=oauth_failed&detail=bad_state`)
    }

    try {
      await handleCallback.execute(code, codeVerifier, userId, brandId)
      return reply.redirect(`${webUrl}/dashboard?connected=tiktok`)
    } catch (err) {
      const msg = err instanceof Error ? err.message.slice(0, 120) : String(err).slice(0, 120)
      app.log.error({ err }, 'TikTok callback handler failed')
      return reply.redirect(`${webUrl}/dashboard?error=oauth_failed&detail=${encodeURIComponent(msg)}`)
    }
  })
}
