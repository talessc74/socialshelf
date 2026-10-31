import Stripe from 'stripe'

// Cliente Stripe compartilhado pelos use-cases de billing (_local-adr-policy-0NN). Só
// api-service fala com o Stripe — generator/publisher nunca importam isto, só leem o
// Subscription já persistido via SubscriptionRepository.
//
// O construtor do SDK do Stripe valida a apiKey na hora (lança se vazia) — diferente do resto
// das integrações deste projeto, que só falham quando a chamada de verdade acontece. Como
// billingRoutes instancia este cliente na inicialização do app (mesmo padrão de generateUrl
// etc. em metaOAuthRoutes), um ambiente sem STRIPE_SECRET_KEY configurada (todo teste
// pré-existente, dev local sem Stripe) quebraria o boot do Fastify inteiro sem isto.
export function createStripeClient(): Stripe {
  const secretKey = process.env['STRIPE_SECRET_KEY'] || 'sk_test_placeholder'
  return new Stripe(secretKey)
}
