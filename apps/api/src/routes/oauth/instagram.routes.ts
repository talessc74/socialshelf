import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { validateState } from '../../lib/csrf.js'
import { resolveWebOrigin } from '../../lib/webOrigin.js'
import { GenerateInstagramAuthUrlUseCase } from '../../use-cases/oauth/GenerateInstagramAuthUrlUseCase.js'
import { HandleInstagramCallbackUseCase } from '../../use-cases/oauth/HandleInstagramCallbackUseCase.js'
import { FirestoreOAuthRepository } from '../../infrastructure/firestore/FirestoreOAuthRepository.js'
import { FirestoreTokenVault } from '../../infrastructure/firestore/FirestoreTokenVault.js'

const callbackQuerySchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
})

// O Instagram devolve o "negar" como error/error_reason/error_description na query — mesmo
// contrato do Facebook Login, tratado antes do schema de sucesso.
const callbackErrorQuerySchema = z.object({
  error: z.string().min(1),
  error_reason: z.string().optional(),
  error_description: z.string().optional(),
  state: z.string().optional(),
})

export async function instagramOAuthRoutes(app: FastifyInstance) {
  const oauthRepo = new FirestoreOAuthRepository()
  const tokenVault = new FirestoreTokenVault()
  const generateUrl = new GenerateInstagramAuthUrlUseCase()
  const handleCallback = new HandleInstagramCallbackUseCase(oauthRepo, tokenVault)

  const webUrl = process.env['WEB_URL'] ?? 'http://localhost:3000'

  app.get(
    '/oauth/instagram/authorize',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const webOrigin = resolveWebOrigin(request.headers.origin)
      const { url } = generateUrl.execute(request.userId, request.brandId, webOrigin)
      return reply.send({ url })
    },
  )

  app.get('/oauth/instagram/callback', async (request, reply) => {
    const deniedResult = callbackErrorQuerySchema.safeParse(request.query)
    if (deniedResult.success) {
      let webOrigin: string | undefined
      if (deniedResult.data.state) {
        try {
          webOrigin = validateState(deniedResult.data.state).webOrigin
        } catch {
          webOrigin = undefined
        }
      }
      return reply.redirect(
        `${webOrigin ?? webUrl}/dashboard?error=oauth_denied&detail=${encodeURIComponent(deniedResult.data.error_reason ?? deniedResult.data.error)}`,
      )
    }

    const result = callbackQuerySchema.safeParse(request.query)
    if (!result.success) {
      return reply.status(400).send({ error: 'Invalid callback parameters' })
    }

    const { code, state } = result.data

    try {
      const { brandId, webOrigin } = validateState(state)
      const redirectBase = webOrigin ?? webUrl
      await handleCallback.execute(code, state, brandId)
      return reply.redirect(`${redirectBase}/dashboard?connected=instagram`)
    } catch (err) {
      app.log.error(err)
      const detail = err instanceof Error ? err.message : 'unknown_error'
      return reply.redirect(
        `${webUrl}/dashboard?error=oauth_failed&detail=${encodeURIComponent(detail)}`,
      )
    }
  })
}
