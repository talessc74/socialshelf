import type { FastifyInstance } from 'fastify'
import { FirestoreAutonomyTickLogRepository } from '../infrastructure/firestore/FirestoreAutonomyTickLogRepository.js'

const RECENT_ENTRIES_LIMIT = 20

// Histórico consultável do tick de autonomia (_local-edr-policy-038, adendo 2026-07-11) —
// antes disso o resultado de cada tentativa (publicado, pulado e por quê, erro) só existia
// por um instante na resposta HTTP que o Cloud Scheduler recebe e descarta.
export async function autonomyTickLogRoutes(app: FastifyInstance) {
  const tickLogRepo = new FirestoreAutonomyTickLogRepository()

  app.get(
    '/autonomy-tick-log',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const entries = await tickLogRepo.findRecentByBrand(request.userId, request.brandId, RECENT_ENTRIES_LIMIT)
      return reply.send({ entries })
    },
  )
}
