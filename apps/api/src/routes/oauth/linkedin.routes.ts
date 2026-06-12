import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { validateState } from '../../lib/csrf.js'
import { GenerateLinkedInAuthUrlUseCase } from '../../use-cases/oauth/GenerateLinkedInAuthUrlUseCase.js'
import { HandleLinkedInCallbackUseCase } from '../../use-cases/oauth/HandleLinkedInCallbackUseCase.js'
import { FirestoreOAuthRepository } from '../../infrastructure/firestore/FirestoreOAuthRepository.js'
import { FirestoreTokenVault } from '../../infrastructure/firestore/FirestoreTokenVault.js'

const callbackQuerySchema = z.object({
  code: z.string().min(1).optional(),
  error: z.string().optional(),
  error_description: z.string().optional(),
  state: z.string().min(1),
  brandId: z.string().optional(),
})

export async function linkedinOAuthRoutes(app: FastifyInstance) {
  const oauthRepo = new FirestoreOAuthRepository()
  const tokenVault = new FirestoreTokenVault()
  const generateUrl = new GenerateLinkedInAuthUrlUseCase()
  const handleCallback = new HandleLinkedInCallbackUseCase(oauthRepo, tokenVault)

  const webUrl = process.env['WEB_URL'] ?? 'http://localhost:3000'

  app.get(
    '/oauth/linkedin/authorize',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { url } = generateUrl.execute(request.userId)
      app.log.info({ url }, 'LinkedIn auth URL generated')
      return reply.send({ url })
    },
  )

  app.get('/oauth/linkedin/callback', async (request, reply) => {
    const result = callbackQuerySchema.safeParse(request.query)
    if (!result.success) {
      return reply.status(400).send({ error: 'missing_required_params' })
    }

    const { code, error, state } = result.data

    if (error || !code) {
      app.log.error({ error, error_description: result.data.error_description }, 'LinkedIn OAuth error')
      return reply.redirect(`${webUrl}/dashboard?error=oauth_failed`)
    }

    try {
      const { userId } = validateState(state)
      const brandId = result.data.brandId ?? userId
      if (brandId !== userId) {
        return reply.redirect(`${webUrl}/dashboard?error=oauth_failed`)
      }
      await handleCallback.execute(code, brandId)
      return reply.redirect(`${webUrl}/dashboard?connected=linkedin`)
    } catch (err) {
      app.log.error(err)
      return reply.redirect(`${webUrl}/dashboard?error=oauth_failed`)
    }
  })
}
