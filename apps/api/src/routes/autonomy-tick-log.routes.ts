import type { FastifyInstance } from 'fastify'
import { resolveEffectivePlanLimits } from '@socialshelf/domain'
import { FirestoreAutonomyTickLogRepository } from '../infrastructure/firestore/FirestoreAutonomyTickLogRepository.js'
import { FirestoreSubscriptionRepository } from '../infrastructure/firestore/FirestoreSubscriptionRepository.js'
import { FirestoreBrandRepository } from '../infrastructure/firestore/FirestoreBrandRepository.js'
import { EnsureSubscriptionUseCase } from '../use-cases/billing/EnsureSubscriptionUseCase.js'

const RECENT_ENTRIES_LIMIT = 20

// Histórico consultável do tick de autonomia (_local-edr-policy-038, adendo 2026-07-11) —
// antes disso o resultado de cada tentativa (publicado, pulado e por quê, erro) só existia
// por um instante na resposta HTTP que o Cloud Scheduler recebe e descarta.
export async function autonomyTickLogRoutes(app: FastifyInstance) {
  const tickLogRepo = new FirestoreAutonomyTickLogRepository()
  const subscriptionRepo = new FirestoreSubscriptionRepository()
  const brandRepo = new FirestoreBrandRepository()
  const ensureSubscription = new EnsureSubscriptionUseCase(subscriptionRepo, brandRepo)

  app.get(
    '/autonomy-tick-log',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const subscription = await ensureSubscription.execute(request.userId, request.userEmail)
      const limits = resolveEffectivePlanLimits(subscription)
      const entries = await tickLogRepo.findRecentByBrand(request.userId, request.brandId, RECENT_ENTRIES_LIMIT)
      // Retenção por plano (_local-adr-policy-0NN, Fase 4e) — filtrado em memória, como
      // findRecentByBrand já faz com o limite de contagem: o volume por marca é baixo (no
      // máximo um tick por hora).
      const filtered =
        limits.historyRetentionDays === null
          ? entries
          : entries.filter((entry) => entry.createdAt >= daysAgo(limits.historyRetentionDays as number))
      return reply.send({ entries: filtered })
    },
  )
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
}
