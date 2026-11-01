import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { resolveEffectivePlanLimits, resolveEffectiveCreditState } from '@socialshelf/domain'
import { resolveWebOrigin, getAllowedWebOrigins } from '../lib/webOrigin.js'
import { createStripeClient } from '../infrastructure/stripe/stripeClient.js'
import { FirestoreSubscriptionRepository } from '../infrastructure/firestore/FirestoreSubscriptionRepository.js'
import { FirestoreBrandRepository } from '../infrastructure/firestore/FirestoreBrandRepository.js'
import { FirestoreCreditBalanceRepository } from '../infrastructure/firestore/FirestoreCreditBalanceRepository.js'
import { EnsureSubscriptionUseCase } from '../use-cases/billing/EnsureSubscriptionUseCase.js'
import { CreateCheckoutSessionUseCase } from '../use-cases/billing/CreateCheckoutSessionUseCase.js'
import { CreatePortalSessionUseCase } from '../use-cases/billing/CreatePortalSessionUseCase.js'
import { CreateCreditsCheckoutSessionUseCase } from '../use-cases/billing/CreateCreditsCheckoutSessionUseCase.js'
import { ALLOWED_CREDIT_PACKS } from '../infrastructure/stripe/priceMapping.js'

const checkoutQuerySchema = z.object({
  tier: z.enum(['starter', 'pro', 'agency']),
  cycle: z.enum(['monthly', 'annual']),
})

const creditsCheckoutQuerySchema = z.object({
  pack: z.coerce.number().refine((n) => (ALLOWED_CREDIT_PACKS as readonly number[]).includes(n), {
    message: `pack must be one of: ${ALLOWED_CREDIT_PACKS.join(', ')}`,
  }),
})

export async function billingRoutes(app: FastifyInstance) {
  const stripe = createStripeClient()
  const subscriptionRepo = new FirestoreSubscriptionRepository()
  const brandRepo = new FirestoreBrandRepository()
  const creditBalanceRepo = new FirestoreCreditBalanceRepository()
  const ensureSubscription = new EnsureSubscriptionUseCase(subscriptionRepo, brandRepo)
  const createCheckout = new CreateCheckoutSessionUseCase(stripe, subscriptionRepo)
  const createPortal = new CreatePortalSessionUseCase(stripe)
  const createCreditsCheckout = new CreateCreditsCheckoutSessionUseCase(stripe, subscriptionRepo)

  const webUrl = process.env['WEB_URL'] ?? 'http://localhost:3000'

  app.get(
    '/billing/subscription',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const subscription = await ensureSubscription.execute(request.userId, request.userEmail)
      const limits = resolveEffectivePlanLimits(subscription)
      return reply.send({ subscription, limits })
    },
  )

  app.get(
    '/billing/checkout',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const parsed = checkoutQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid request query', details: parsed.error.flatten() })
      }

      const subscription = await ensureSubscription.execute(request.userId, request.userEmail)
      const webOrigin = resolveWebOrigin(request.headers.origin) ?? getAllowedWebOrigins()[0] ?? webUrl

      try {
        const { url } = await createCheckout.execute({
          subscription,
          userEmail: request.userEmail,
          tier: parsed.data.tier,
          cycle: parsed.data.cycle,
          webOrigin,
        })
        return reply.send({ url })
      } catch (err) {
        app.log.error(err)
        return reply.status(502).send({ error: 'checkout_session_failed' })
      }
    },
  )

  app.get(
    '/billing/portal',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const subscription = await ensureSubscription.execute(request.userId, request.userEmail)
      if (!subscription.stripeCustomerId) {
        return reply.status(409).send({ error: 'no_stripe_customer' })
      }

      const webOrigin = resolveWebOrigin(request.headers.origin) ?? getAllowedWebOrigins()[0] ?? webUrl

      try {
        const { url } = await createPortal.execute(subscription.stripeCustomerId, webOrigin)
        return reply.send({ url })
      } catch (err) {
        app.log.error(err)
        return reply.status(502).send({ error: 'portal_session_failed' })
      }
    },
  )

  app.get(
    '/billing/credits',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const subscription = await ensureSubscription.execute(request.userId, request.userEmail)
      const limits = resolveEffectivePlanLimits(subscription)
      const balance = await creditBalanceRepo.findByUserId(request.userId)
      const state = resolveEffectiveCreditState(balance, limits.monthlyCreditsIncluded, new Date())
      return reply.send(state)
    },
  )

  app.get(
    '/billing/credits/checkout',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const parsed = creditsCheckoutQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid request query', details: parsed.error.flatten() })
      }

      const subscription = await ensureSubscription.execute(request.userId, request.userEmail)
      const webOrigin = resolveWebOrigin(request.headers.origin) ?? getAllowedWebOrigins()[0] ?? webUrl

      try {
        const { url } = await createCreditsCheckout.execute({
          subscription,
          userEmail: request.userEmail,
          creditAmount: parsed.data.pack,
          webOrigin,
        })
        return reply.send({ url })
      } catch (err) {
        app.log.error(err)
        return reply.status(502).send({ error: 'checkout_session_failed' })
      }
    },
  )
}
