import type { FastifyInstance } from 'fastify'
import { resolveEffectivePlanLimits, resolveEffectiveCreditState } from '@socialshelf/domain'
import { GetBrandAiUsageSummaryUseCase } from '../use-cases/ai-usage/GetBrandAiUsageSummaryUseCase.js'
import { FirestoreAiUsageReaderRepository } from '../infrastructure/firestore/FirestoreAiUsageReaderRepository.js'
import { FirestoreSubscriptionRepository } from '../infrastructure/firestore/FirestoreSubscriptionRepository.js'
import { FirestoreBrandRepository } from '../infrastructure/firestore/FirestoreBrandRepository.js'
import { FirestoreCreditBalanceRepository } from '../infrastructure/firestore/FirestoreCreditBalanceRepository.js'
import { EnsureSubscriptionUseCase } from '../use-cases/billing/EnsureSubscriptionUseCase.js'

// Gasto de IA da própria conta — qualquer usuário autenticado enxerga só a sua marca
// (findByBrand), diferente de /admin/ai-usage que exige requireAdmin (_local-edr-policy-073).
// O histórico em R$ (summary) é só informativo desde que o saldo de créditos
// (_local-adr-policy-0NN) virou o mecanismo real de trava — credits é o que de fato controla
// se o usuário ainda pode gerar.
export async function aiUsageRoutes(app: FastifyInstance) {
  const aiUsageReader = new FirestoreAiUsageReaderRepository()
  const getBrandAiUsageSummary = new GetBrandAiUsageSummaryUseCase(aiUsageReader)
  const subscriptionRepo = new FirestoreSubscriptionRepository()
  const brandRepo = new FirestoreBrandRepository()
  const creditBalanceRepo = new FirestoreCreditBalanceRepository()
  const ensureSubscription = new EnsureSubscriptionUseCase(subscriptionRepo, brandRepo)

  app.get(
    '/ai-usage',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const subscription = await ensureSubscription.execute(request.userId, request.userEmail)
      const limits = resolveEffectivePlanLimits(subscription)
      const summary = await getBrandAiUsageSummary.execute(request.userId, request.brandId, limits.historyRetentionDays)
      const balance = await creditBalanceRepo.findByUserId(request.userId)
      const credits = resolveEffectiveCreditState(balance, limits.monthlyCreditsIncluded, new Date())
      return reply.send({ ...summary, credits })
    },
  )
}
