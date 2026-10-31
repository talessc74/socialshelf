import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { resolveEffectivePlanLimits } from '@socialshelf/domain'
import type { PlanLimits } from '@socialshelf/domain'
import { FirestoreBrandRepository } from '../infrastructure/firestore/FirestoreBrandRepository.js'
import { FirestoreSubscriptionRepository } from '../infrastructure/firestore/FirestoreSubscriptionRepository.js'
import { EnsureSubscriptionUseCase } from '../use-cases/billing/EnsureSubscriptionUseCase.js'

declare module 'fastify' {
  interface FastifyInstance {
    requirePlanFeature: (
      feature: 'tiktokVideo' | 'photoCampaigns' | 'performanceAnalytics',
    ) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>
  }
}

const FEATURE_FLAG: Record<'tiktokVideo' | 'photoCampaigns' | 'performanceAnalytics', keyof PlanLimits> = {
  tiktokVideo: 'allowTikTokVideo',
  photoCampaigns: 'allowPhotoCampaigns',
  performanceAnalytics: 'allowPerformanceAnalytics',
}

const UPGRADE_SUGGESTION: Record<string, string | null> = {
  legacy: null,
  free: 'starter',
  starter: 'pro',
  pro: 'agency',
  agency: null,
}

// Gate de feature paga por plano — sempre encadeado depois de app.authenticate (precisa de
// request.userId/userEmail já preenchidos). Checado no momento da requisição, não só ao salvar
// configuração, pra um downgrade de plano ser respeitado na hora (_local-adr-policy-0NN, Fase
// 4d) — mesmo princípio de segurança contra downgrade do teto de gasto diário (Fase 4b).
export async function registerPlanLimitsMiddleware(app: FastifyInstance): Promise<void> {
  const brandRepo = new FirestoreBrandRepository()
  const subscriptionRepo = new FirestoreSubscriptionRepository()
  const ensureSubscription = new EnsureSubscriptionUseCase(subscriptionRepo, brandRepo)

  app.decorate('requirePlanFeature', (feature: 'tiktokVideo' | 'photoCampaigns' | 'performanceAnalytics') => {
    return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const subscription = await ensureSubscription.execute(request.userId, request.userEmail)
      const limits = resolveEffectivePlanLimits(subscription)
      if (!limits[FEATURE_FLAG[feature]]) {
        return reply.status(403).send({
          error: 'plan_feature_not_included',
          feature,
          upgradeTier: UPGRADE_SUGGESTION[subscription.tier] ?? null,
        })
      }
    }
  })
}
