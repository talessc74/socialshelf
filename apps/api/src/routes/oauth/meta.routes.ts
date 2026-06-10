import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { validateState } from '../../lib/csrf.js'
import { GenerateMetaAuthUrlUseCase } from '../../use-cases/oauth/GenerateMetaAuthUrlUseCase.js'
import { HandleMetaCallbackUseCase } from '../../use-cases/oauth/HandleMetaCallbackUseCase.js'
import { FirestoreOAuthRepository } from '../../infrastructure/firestore/FirestoreOAuthRepository.js'
import { SecretManagerTokenVault } from '../../infrastructure/secret-manager/SecretManagerTokenVault.js'

const callbackQuerySchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
  brandId: z.string().optional(),
})

export async function metaOAuthRoutes(app: FastifyInstance) {
  const oauthRepo = new FirestoreOAuthRepository()
  const tokenVault = new SecretManagerTokenVault()
  const generateUrl = new GenerateMetaAuthUrlUseCase()
  const handleCallback = new HandleMetaCallbackUseCase(oauthRepo, tokenVault)

  const webUrl = process.env['WEB_URL'] ?? 'http://localhost:3000'

  app.get(
    '/oauth/meta/authorize',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { url } = generateUrl.execute(request.userId)
      return reply.send({ url })
    },
  )

  app.get('/oauth/meta/callback', async (request, reply) => {
    const result = callbackQuerySchema.safeParse(request.query)
    if (!result.success) {
      return reply.status(400).send({ error: 'Invalid callback parameters' })
    }

    const { code, state } = result.data

    try {
      const { userId } = validateState(state)
      const brandId = result.data.brandId ?? userId
      const { facebook, instagram } = await handleCallback.execute(code, state, brandId)
      const connected = [
        facebook ? 'facebook' : null,
        instagram ? 'instagram' : null,
      ]
        .filter(Boolean)
        .join(',')

      return reply.redirect(`${webUrl}/dashboard?connected=${connected}`)
    } catch (err) {
      app.log.error(err)
      return reply.redirect(`${webUrl}/dashboard?error=oauth_failed`)
    }
  })
}
