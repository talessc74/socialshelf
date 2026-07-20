import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { validateState } from '../../lib/csrf.js'
import { resolveWebOrigin } from '../../lib/webOrigin.js'
import { GenerateMetaAuthUrlUseCase } from '../../use-cases/oauth/GenerateMetaAuthUrlUseCase.js'
import { HandleMetaCallbackUseCase } from '../../use-cases/oauth/HandleMetaCallbackUseCase.js'
import { GetPendingMetaPageSelectionUseCase } from '../../use-cases/oauth/GetPendingMetaPageSelectionUseCase.js'
import { ConfirmMetaPageSelectionUseCase } from '../../use-cases/oauth/ConfirmMetaPageSelectionUseCase.js'
import { FirestoreOAuthRepository } from '../../infrastructure/firestore/FirestoreOAuthRepository.js'
import { FirestoreTokenVault } from '../../infrastructure/firestore/FirestoreTokenVault.js'

const callbackQuerySchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
})

const callbackErrorQuerySchema = z.object({
  error: z.string().min(1),
  error_reason: z.string().optional(),
  state: z.string().optional(),
})

const pendingParamsSchema = z.object({
  pendingId: z.string().min(1),
})

const selectBodySchema = z.object({
  pendingId: z.string().min(1),
  pageId: z.string().min(1),
})

export async function metaOAuthRoutes(app: FastifyInstance) {
  const oauthRepo = new FirestoreOAuthRepository()
  const tokenVault = new FirestoreTokenVault()
  const generateUrl = new GenerateMetaAuthUrlUseCase()
  const handleCallback = new HandleMetaCallbackUseCase(oauthRepo, tokenVault)
  const getPending = new GetPendingMetaPageSelectionUseCase(tokenVault)
  const confirmSelection = new ConfirmMetaPageSelectionUseCase(oauthRepo, tokenVault)

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
      const outcome = await handleCallback.execute(code, state, brandId)

      // Só o caso 'pending' vai pra /dashboard/accounts (onde mora o seletor de Página) — os
      // demais mantêm o destino de sempre (/dashboard), que já trata connected=/error= há mais
      // tempo e tem seu próprio aviso de sucesso/erro.
      if (outcome.status === 'pending') {
        return reply.redirect(`${redirectBase}/dashboard/accounts?metaPagePending=${outcome.pendingId}`)
      }

      // Nenhuma Página encontrada: a conta não tem Página do Facebook (ou o Instagram é pessoal,
      // não Business/Creator vinculado a uma Página). Antes isso voltava pro dashboard com
      // connected= vazio — que a tela lê como falsy e não mostra mensagem nenhuma, deixando o
      // usuário sem saber por que "não aconteceu nada". Manda pra Central de Contas com um aviso
      // que explica o pré-requisito e como resolver.
      if (!outcome.facebook && !outcome.instagram) {
        return reply.redirect(`${redirectBase}/dashboard/accounts?metaResult=no-pages`)
      }

      const connected = [
        outcome.facebook ? 'facebook' : null,
        outcome.instagram ? 'instagram' : null,
      ]
        .filter(Boolean)
        .join(',')

      // Facebook conectou mas Instagram não: a Página escolhida não tem conta Business/Creator do
      // Instagram vinculada (persistMetaPageConnection só cria a conexão do Instagram quando a
      // Página tem instagram_business_account). Sinaliza pro dashboard avisar que o Instagram
      // ficou de fora e por quê, em vez de um "Conectado: facebook" que se lê como "conectou tudo".
      const note = outcome.facebook && !outcome.instagram ? '&metaNote=no-instagram' : ''

      return reply.redirect(`${redirectBase}/dashboard?connected=${connected}${note}`)
    } catch (err) {
      app.log.error(err)
      const detail = err instanceof Error ? err.message : 'unknown_error'
      return reply.redirect(
        `${webUrl}/dashboard?error=oauth_failed&detail=${encodeURIComponent(detail)}`,
      )
    }
  })

  app.get(
    '/oauth/meta/pending/:pendingId',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const result = pendingParamsSchema.safeParse(request.params)
      if (!result.success) {
        return reply.status(400).send({ error: 'invalid_pending_id' })
      }

      try {
        const { pages } = await getPending.execute(result.data.pendingId, request.userId)
        return reply.send({ pages })
      } catch (err) {
        app.log.error(err)
        const detail = err instanceof Error ? err.message : 'unknown_error'
        return reply.status(404).send({ error: detail })
      }
    },
  )

  app.post(
    '/oauth/meta/select',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const result = selectBodySchema.safeParse(request.body)
      if (!result.success) {
        return reply.status(400).send({ error: 'invalid_request_body' })
      }

      try {
        const { facebook, instagram } = await confirmSelection.execute(
          result.data.pendingId,
          request.userId,
          result.data.pageId,
        )
        return reply.send({ facebook, instagram })
      } catch (err) {
        app.log.error(err)
        const detail = err instanceof Error ? err.message : 'unknown_error'
        return reply.status(400).send({ error: detail })
      }
    },
  )
}
