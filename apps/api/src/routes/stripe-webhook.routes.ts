import type { FastifyInstance } from 'fastify'
import { createStripeClient } from '../infrastructure/stripe/stripeClient.js'
import { FirestoreSubscriptionRepository } from '../infrastructure/firestore/FirestoreSubscriptionRepository.js'
import { FirestoreCreditBalanceRepository } from '../infrastructure/firestore/FirestoreCreditBalanceRepository.js'
import { HandleStripeWebhookUseCase } from '../use-cases/billing/HandleStripeWebhookUseCase.js'

// Rota chamada pelo Stripe, não pelo nosso frontend — fica fora de app.authenticate (não há
// token Firebase, o Stripe assina a requisição de outro jeito) e verifica a assinatura
// manualmente dentro do handler, mesma forma de /internal/storage-cleanup-tick
// (storage-cleanup.routes.ts), trocando o segredo compartilhado em header por
// stripe.webhooks.constructEvent (_local-adr-policy-0NN).
export async function stripeWebhookRoutes(app: FastifyInstance) {
  const stripe = createStripeClient()
  const subscriptionRepo = new FirestoreSubscriptionRepository()
  const creditBalanceRepo = new FirestoreCreditBalanceRepository()
  const webhookSecret = process.env['STRIPE_WEBHOOK_SECRET'] ?? ''
  const handleWebhook = new HandleStripeWebhookUseCase(stripe, subscriptionRepo, creditBalanceRepo, webhookSecret)

  // A verificação de assinatura do Stripe precisa dos bytes exatos do corpo da requisição — o
  // parser JSON global de app.ts já fez o parse/serialize antes de chegar aqui, o que quebraria
  // a assinatura. Este override só vale dentro do encapsulamento deste plugin (padrão de
  // plugins do Fastify), nunca afeta as outras rotas JSON do app.
  app.addContentTypeParser('application/json', { parseAs: 'buffer' }, (_request, body, done) => {
    done(null, body)
  })

  app.post('/webhooks/stripe', async (request, reply) => {
    const signature = request.headers['stripe-signature']
    if (typeof signature !== 'string') {
      return reply.status(400).send({ error: 'missing_stripe_signature' })
    }

    try {
      await handleWebhook.execute(request.body as Buffer, signature)
      return reply.status(200).send({ received: true })
    } catch (err) {
      app.log.error(err)
      return reply.status(400).send({ error: 'invalid_stripe_webhook' })
    }
  })
}
