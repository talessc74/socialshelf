import type { FastifyInstance } from 'fastify'
import { FirestoreOAuthRepository } from '../infrastructure/firestore/FirestoreOAuthRepository.js'
import { FirestoreTokenVault } from '../infrastructure/firestore/FirestoreTokenVault.js'
import { RefreshMetaConnectionsUseCase } from '../use-cases/RefreshMetaConnectionsUseCase.js'

// Acionado pelo Cloud Scheduler uma vez por dia (autenticação OIDC + X-Internal-Secret, mesmo
// padrão de /internal/autonomy-tick) — renova proativamente os tokens de usuário Meta
// (Facebook/Instagram) que vencem nos próximos dias, fechando o gap descrito em
// _local-adr-policy-016 (emenda 2026-11-22): sem isso, a conexão só quebra quando o token já
// expirou de vez, e aí não há mais como recuperar sem reconexão manual do usuário.
export async function oauthTokenRefreshRoutes(app: FastifyInstance) {
  const internalSecret = process.env['INTERNAL_SECRET']
  if (!internalSecret) {
    throw new Error('INTERNAL_SECRET env var is required — set it before starting the publisher service')
  }

  const useCase = new RefreshMetaConnectionsUseCase(new FirestoreOAuthRepository(), new FirestoreTokenVault())

  app.post('/internal/oauth-token-refresh-tick', async (request, reply) => {
    const header = request.headers['x-internal-secret']
    if (header !== internalSecret) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    const result = await useCase.execute()
    if (result.failed.length > 0) {
      app.log.error({ failed: result.failed }, 'oauth token refresh: one or more connections failed to refresh')
    }
    return reply.send(result)
  })
}
