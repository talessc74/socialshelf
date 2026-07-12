import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { validateState } from '../../lib/csrf.js'
import { resolveWebOrigin } from '../../lib/webOrigin.js'
import { GenerateMetaAuthUrlUseCase } from '../../use-cases/oauth/GenerateMetaAuthUrlUseCase.js'
import { HandleMetaCallbackUseCase } from '../../use-cases/oauth/HandleMetaCallbackUseCase.js'
import { FirestoreOAuthRepository } from '../../infrastructure/firestore/FirestoreOAuthRepository.js'
import { FirestoreTokenVault } from '../../infrastructure/firestore/FirestoreTokenVault.js'

const callbackQuerySchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
})

const callbackErrorQuerySchema = z.object({
  error: z.string().min(1),
  error_reason: z.string().optional(),
})

export async function metaOAuthRoutes(app: FastifyInstance) {
  const oauthRepo = new FirestoreOAuthRepository()
  const tokenVault = new FirestoreTokenVault()
  const generateUrl = new GenerateMetaAuthUrlUseCase()
  const handleCallback = new HandleMetaCallbackUseCase(oauthRepo, tokenVault)

  const webUrl = process.env['WEB_URL'] ?? 'http://localhost:3000'

  app.get(
    '/oauth/meta/authorize',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const webOrigin = resolveWebOrigin(request.headers.origin)
      const { url } = generateUrl.execute(request.userId, request.brandId, webOrigin)
      return reply.send({ url })
    },
  )

  app.get('/oauth/meta/callback', async (request, reply) => {
    const deniedResult = callbackErrorQuerySchema.safeParse(request.query)
    if (deniedResult.success) {
      return reply.redirect(
        `${webUrl}/dashboard?error=oauth_denied&detail=${encodeURIComponent(deniedResult.data.error_reason ?? deniedResult.data.error)}`,
      )
    }

    const result = callbackQuerySchema.safeParse(request.query)
    if (!result.success) {
      return reply.status(400).send({ error: 'Invalid callback parameters' })
    }

    const { code, state } = result.data

    try {
      const { brandId, webOrigin } = validateState(state)
      const { facebook, instagram } = await handleCallback.execute(code, state, brandId)
      const connected = [
        facebook ? 'facebook' : null,
        instagram ? 'instagram' : null,
      ]
        .filter(Boolean)
        .join(',')

      return reply.redirect(`${webOrigin ?? webUrl}/dashboard?connected=${connected}`)
    } catch (err) {
      app.log.error(err)
      const detail = err instanceof Error ? err.message : 'unknown_error'
      return reply.redirect(
        `${webUrl}/dashboard?error=oauth_failed&detail=${encodeURIComponent(detail)}`,
      )
    }
  })
}
