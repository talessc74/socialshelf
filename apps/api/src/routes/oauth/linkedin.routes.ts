import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { validateState } from '../../lib/csrf.js'
import { resolveWebOrigin } from '../../lib/webOrigin.js'
import { GenerateLinkedInAuthUrlUseCase } from '../../use-cases/oauth/GenerateLinkedInAuthUrlUseCase.js'
import { HandleLinkedInCallbackUseCase } from '../../use-cases/oauth/HandleLinkedInCallbackUseCase.js'
import { FirestoreOAuthRepository } from '../../infrastructure/firestore/FirestoreOAuthRepository.js'
import { FirestoreTokenVault } from '../../infrastructure/firestore/FirestoreTokenVault.js'

const callbackQuerySchema = z.object({
  code: z.string().min(1).optional(),
  error: z.string().optional(),
  error_description: z.string().optional(),
  state: z.string().min(1),
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
      const webOrigin = resolveWebOrigin(request.headers.origin)
      const { url } = generateUrl.execute(request.userId, request.brandId, webOrigin)
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
      // state ainda é o mesmo valor assinado emitido no /authorize, mesmo quando o
      // usuário nega a permissão — seguro extrair webOrigin dele para o redirect.
      let webOrigin: string | undefined
      try {
        webOrigin = validateState(state).webOrigin
      } catch {
        webOrigin = undefined
      }
      return reply.redirect(`${webOrigin ?? webUrl}/dashboard?error=oauth_failed`)
    }

    try {
      const { userId, brandId, webOrigin } = validateState(state)
      await handleCallback.execute(code, userId, brandId)
      return reply.redirect(`${webOrigin ?? webUrl}/dashboard?connected=linkedin`)
    } catch (err) {
      app.log.error(err)
      return reply.redirect(`${webUrl}/dashboard?error=oauth_failed`)
    }
  })
}
