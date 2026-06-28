import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { validateState } from '../../lib/csrf.js'
import { GenerateLinkedInPageAuthUrlUseCase } from '../../use-cases/oauth/GenerateLinkedInPageAuthUrlUseCase.js'
import { HandleLinkedInPageCallbackUseCase } from '../../use-cases/oauth/HandleLinkedInPageCallbackUseCase.js'
import { GetPendingLinkedInPageSelectionUseCase } from '../../use-cases/oauth/GetPendingLinkedInPageSelectionUseCase.js'
import { ConfirmLinkedInPageSelectionUseCase } from '../../use-cases/oauth/ConfirmLinkedInPageSelectionUseCase.js'
import { FirestoreOAuthRepository } from '../../infrastructure/firestore/FirestoreOAuthRepository.js'
import { FirestoreTokenVault } from '../../infrastructure/firestore/FirestoreTokenVault.js'

const callbackQuerySchema = z.object({
  code: z.string().min(1).optional(),
  error: z.string().optional(),
  error_description: z.string().optional(),
  state: z.string().min(1),
})

const pendingParamsSchema = z.object({
  pendingId: z.string().min(1),
})

const selectBodySchema = z.object({
  pendingId: z.string().min(1),
  organizationUrn: z.string().min(1),
})

export async function linkedinPageOAuthRoutes(app: FastifyInstance) {
  const oauthRepo = new FirestoreOAuthRepository()
  const tokenVault = new FirestoreTokenVault()
  const generateUrl = new GenerateLinkedInPageAuthUrlUseCase()
  const handleCallback = new HandleLinkedInPageCallbackUseCase(oauthRepo, tokenVault)
  const getPending = new GetPendingLinkedInPageSelectionUseCase(tokenVault)
  const confirmSelection = new ConfirmLinkedInPageSelectionUseCase(oauthRepo, tokenVault)

  const webUrl = process.env['WEB_URL'] ?? 'http://localhost:3000'

  app.get(
    '/oauth/linkedin-page/authorize',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { url } = generateUrl.execute(request.userId, request.brandId)
      return reply.send({ url })
    },
  )

  app.get('/oauth/linkedin-page/callback', async (request, reply) => {
    const result = callbackQuerySchema.safeParse(request.query)
    if (!result.success) {
      return reply.status(400).send({ error: 'missing_required_params' })
    }

    const { code, error, state } = result.data

    if (error || !code) {
      app.log.error({ error, error_description: result.data.error_description }, 'LinkedIn page OAuth error')
      return reply.redirect(`${webUrl}/dashboard/accounts?error=oauth_failed`)
    }

    try {
      const { userId, brandId } = validateState(state)
      const outcome = await handleCallback.execute(code, userId, brandId)

      if (outcome.status === 'pending') {
        return reply.redirect(`${webUrl}/dashboard/accounts?linkedinPagePending=${outcome.pendingId}`)
      }
      return reply.redirect(`${webUrl}/dashboard/accounts?connected=linkedin-page`)
    } catch (err) {
      app.log.error(err)
      const detail = err instanceof Error ? err.message : 'oauth_failed'
      return reply.redirect(`${webUrl}/dashboard/accounts?error=${encodeURIComponent(detail)}`)
    }
  })

  app.get(
    '/oauth/linkedin-page/pending/:pendingId',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const result = pendingParamsSchema.safeParse(request.params)
      if (!result.success) {
        return reply.status(400).send({ error: 'invalid_pending_id' })
      }

      try {
        const { organizations } = await getPending.execute(result.data.pendingId, request.userId)
        return reply.send({ organizations })
      } catch (err) {
        app.log.error(err)
        const detail = err instanceof Error ? err.message : 'unknown_error'
        return reply.status(404).send({ error: detail })
      }
    },
  )

  app.post(
    '/oauth/linkedin-page/select',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const result = selectBodySchema.safeParse(request.body)
      if (!result.success) {
        return reply.status(400).send({ error: 'invalid_request_body' })
      }

      try {
        const connection = await confirmSelection.execute(
          result.data.pendingId,
          request.userId,
          result.data.organizationUrn,
        )
        return reply.send({ connection })
      } catch (err) {
        app.log.error(err)
        const detail = err instanceof Error ? err.message : 'unknown_error'
        return reply.status(400).send({ error: detail })
      }
    },
  )
}
