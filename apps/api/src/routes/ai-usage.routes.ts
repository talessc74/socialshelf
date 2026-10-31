import type { FastifyInstance } from 'fastify'
import { resolveEffectivePlanLimits } from '@socialshelf/domain'
import { GetBrandAiUsageSummaryUseCase } from '../use-cases/ai-usage/GetBrandAiUsageSummaryUseCase.js'
import { FirestoreAiUsageReaderRepository } from '../infrastructure/firestore/FirestoreAiUsageReaderRepository.js'
import { FirestoreSubscriptionRepository } from '../infrastructure/firestore/FirestoreSubscriptionRepository.js'
import { FirestoreBrandRepository } from '../infrastructure/firestore/FirestoreBrandRepository.js'
import { EnsureSubscriptionUseCase } from '../use-cases/billing/EnsureSubscriptionUseCase.js'

// Gasto de IA da própria conta — qualquer usuário autenticado enxerga só a sua marca
// (findByBrand), diferente de /admin/ai-usage que exige requireAdmin (_local-edr-policy-073).
export async function aiUsageRoutes(app: FastifyInstance) {
  const aiUsageReader = new FirestoreAiUsageReaderRepository()
  const getBrandAiUsageSummary = new GetBrandAiUsageSummaryUseCase(aiUsageReader)
  const subscriptionRepo = new FirestoreSubscriptionRepository()
  const brandRepo = new FirestoreBrandRepository()
  const ensureSubscription = new EnsureSubscriptionUseCase(subscriptionRepo, brandRepo)

  app.get(
    '/ai-usage',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const subscription = await ensureSubscription.execute(request.userId, request.userEmail)
      const limits = resolveEffectivePlanLimits(subscription)
      const summary = await getBrandAiUsageSummary.execute(request.userId, request.brandId, limits.historyRetentionDays)
      return reply.send({ ...summary, planDailySpendingLimitBrl: limits.defaultDailyAiSpendingLimitBrl })
    },
  )
}
