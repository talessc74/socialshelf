import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { validateState } from '../../lib/csrf.js'
import { GenerateXAuthUrlUseCase } from '../../use-cases/oauth/GenerateXAuthUrlUseCase.js'
import { HandleXCallbackUseCase } from '../../use-cases/oauth/HandleXCallbackUseCase.js'
import { FirestoreOAuthRepository } from '../../infrastructure/firestore/FirestoreOAuthRepository.js'
import { SecretManagerTokenVault } from '../../infrastructure/secret-manager/SecretManagerTokenVault.js'

const callbackQuerySchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
  brandId: z.string().optional(),
})

export async function xOAuthRoutes(app: FastifyInstance) {
  const oauthRepo = new FirestoreOAuthRepository()
  const tokenVault = new SecretManagerTokenVault()
  const generateUrl = new GenerateXAuthUrlUseCase()
  const handleCallback = new HandleXCallbackUseCase(oauthRepo, tokenVault)

  const webUrl = process.env['WEB_URL'] ?? 'http://localhost:3000'

  app.get(
    '/oauth/x/authorize',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { url } = generateUrl.execute(request.userId)
      return reply.send({ url })
    },
  )

  app.get('/oauth/x/callback', async (request, reply) => {
    const result = callbackQuerySchema.safeParse(request.query)
    if (!result.success) {
      return reply.status(400).send({ error: 'Invalid callback parameters' })
    }

    const { code, state } = result.data

    try {
      const { userId, codeVerifier } = validateState(state)

      if (!codeVerifier) {
        app.log.error('codeVerifier missing from state — OAuth flow started without PKCE embed')
        return reply.redirect(`${webUrl}/dashboard?error=oauth_failed`)
      }

      const brandId = result.data.brandId ?? userId
      if (brandId !== userId) {
        return reply.redirect(`${webUrl}/dashboard?error=oauth_failed`)
      }

      await handleCallback.execute(code, state, codeVerifier, brandId)
      return reply.redirect(`${webUrl}/dashboard?connected=twitter`)
    } catch (err) {
      app.log.error(err)
      return reply.redirect(`${webUrl}/dashboard?error=oauth_failed`)
    }
  })
}
