import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { GenerateLinkedInAuthUrlUseCase } from '../../use-cases/oauth/GenerateLinkedInAuthUrlUseCase.js'
import { HandleLinkedInCallbackUseCase } from '../../use-cases/oauth/HandleLinkedInCallbackUseCase.js'
import { FirestoreOAuthRepository } from '../../infrastructure/firestore/FirestoreOAuthRepository.js'
import { SecretManagerTokenVault } from '../../infrastructure/secret-manager/SecretManagerTokenVault.js'

const callbackQuerySchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
  brandId: z.string().min(1),
})

export async function linkedinOAuthRoutes(app: FastifyInstance) {
  const oauthRepo = new FirestoreOAuthRepository()
  const tokenVault = new SecretManagerTokenVault()
  const generateUrl = new GenerateLinkedInAuthUrlUseCase()
  const handleCallback = new HandleLinkedInCallbackUseCase(oauthRepo, tokenVault)

  const webUrl = process.env['WEB_URL'] ?? 'http://localhost:3000'

  app.get(
    '/oauth/linkedin/authorize',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { url } = generateUrl.execute(request.userId)
      return reply.send({ url })
    },
  )

  app.get('/oauth/linkedin/callback', async (request, reply) => {
    const result = callbackQuerySchema.safeParse(request.query)
    if (!result.success) {
      return reply.status(400).send({ error: 'Invalid callback parameters' })
    }

    const { code, state, brandId } = result.data

    try {
      await handleCallback.execute(code, state, brandId)
      return reply.redirect(`${webUrl}/dashboard?connected=linkedin`)
    } catch (err) {
      app.log.error(err)
      return reply.redirect(`${webUrl}/dashboard?error=oauth_failed`)
    }
  })
}
