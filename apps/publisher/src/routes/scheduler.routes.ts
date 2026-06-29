import type { FastifyInstance } from 'fastify'
import { makeScheduledPostsTick } from '../scheduler/ScheduledPostsPoller.js'
import type { PublishPostUseCase } from '../use-cases/PublishPostUseCase.js'

/**
 * Acionado pelo Cloud Scheduler (autenticação OIDC validada pelo IAM do Cloud Run, já que
 * o serviço roda com --no-allow-unauthenticated) — garante que instâncias paradas por
 * --min-instances=0 sejam acordadas no horário agendado dos posts, em vez de depender
 * apenas do setInterval em memória, que só roda enquanto a instância já está de pé.
 */
export async function schedulerRoutes(app: FastifyInstance, useCase: PublishPostUseCase) {
  const internalSecret = process.env['INTERNAL_SECRET']
  if (!internalSecret) {
    throw new Error('INTERNAL_SECRET env var is required — set it before starting the publisher service')
  }

  const tick = makeScheduledPostsTick(useCase, app.log)

  app.post('/internal/scheduler-tick', async (request, reply) => {
    const header = request.headers['x-internal-secret']
    if (header !== internalSecret) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    await tick()
    return reply.send({ ok: true })
  })
}
