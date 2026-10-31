/**
 * Cria no Stripe (modo de teste) os produtos e preços da tabela de planos de
 * _local-bdr-policy-013, pra não precisar clicar isso manualmente no Dashboard antes de testar
 * o Checkout (_local-adr-policy-043). Idempotente por tier: se um produto já existe (achado
 * pela metadata `socialshelf_tier`), reaproveita em vez de duplicar.
 *
 * Ao final, imprime o bloco pronto pra colar em apps/api/.env — os nomes das env vars batem
 * exatamente com apps/api/src/infrastructure/stripe/priceMapping.ts.
 *
 * As 4 env vars de "marca profissional adicional" (*_ADDITIONAL_BRAND_*) ainda não têm nenhum
 * fluxo de checkout no código que as leia — o self-serve de comprar marca extra não foi
 * implementado, só a Subscription.additionalProfessionalBrands existe como campo. Este script
 * cria os preços de qualquer forma (ficam prontos pro dia em que esse fluxo for construído),
 * mas isso não bloqueia testar assinatura/trial/gates, que são o essencial.
 *
 * Usage:
 *   STRIPE_SECRET_KEY=sk_test_... pnpm --filter @socialshelf/api exec tsx ../../scripts/seed-stripe-test-prices.ts
 */

import Stripe from 'stripe'

const STRIPE_SECRET_KEY = process.env['STRIPE_SECRET_KEY'] ?? ''

if (!STRIPE_SECRET_KEY) {
  console.error('ERROR: STRIPE_SECRET_KEY env var is required')
  process.exit(1)
}
if (!STRIPE_SECRET_KEY.startsWith('sk_test_')) {
  console.error('ERROR: recusado — esta chave não parece ser de modo de teste (sk_test_...). Este script nunca deve rodar contra uma conta Stripe real.')
  process.exit(1)
}

const stripe = new Stripe(STRIPE_SECRET_KEY)

// Preços em centavos de BRL, espelhando a tabela de _local-bdr-policy-013.
const PLANS: Array<{
  tier: string
  productName: string
  monthlyCents: number
  annualCents: number
  envPrefix: string
}> = [
  { tier: 'starter', productName: 'SocialShelf — Starter', monthlyCents: 2900, annualCents: 29000, envPrefix: 'STRIPE_PRICE_ID_STARTER' },
  { tier: 'pro', productName: 'SocialShelf — Pro', monthlyCents: 9700, annualCents: 97000, envPrefix: 'STRIPE_PRICE_ID_PRO' },
  { tier: 'agency', productName: 'SocialShelf — Agência', monthlyCents: 24900, annualCents: 249000, envPrefix: 'STRIPE_PRICE_ID_AGENCY' },
  { tier: 'pro_additional_brand', productName: 'SocialShelf — Pro, marca adicional', monthlyCents: 7900, annualCents: 79000, envPrefix: 'STRIPE_PRICE_ID_PRO_ADDITIONAL_BRAND' },
  { tier: 'agency_additional_brand', productName: 'SocialShelf — Agência, marca adicional', monthlyCents: 6900, annualCents: 69000, envPrefix: 'STRIPE_PRICE_ID_AGENCY_ADDITIONAL_BRAND' },
]

async function findOrCreateProduct(tier: string, productName: string): Promise<Stripe.Product> {
  const existing = await stripe.products.list({ limit: 100, active: true })
  const found = existing.data.find((p) => p.metadata['socialshelf_tier'] === tier)
  if (found) {
    console.log(`Produto já existe para ${tier}: ${found.id}`)
    return found
  }
  const created = await stripe.products.create({ name: productName, metadata: { socialshelf_tier: tier } })
  console.log(`Produto criado para ${tier}: ${created.id}`)
  return created
}

async function findOrCreatePrice(product: Stripe.Product, tier: string, cycle: 'monthly' | 'annual', unitAmount: number): Promise<Stripe.Price> {
  const existingPrices = await stripe.prices.list({ product: product.id, limit: 100, active: true })
  const found = existingPrices.data.find((p) => p.metadata['socialshelf_cycle'] === cycle)
  if (found) {
    console.log(`  Preço ${cycle} já existe: ${found.id}`)
    return found
  }
  const created = await stripe.prices.create({
    product: product.id,
    currency: 'brl',
    unit_amount: unitAmount,
    recurring: { interval: cycle === 'monthly' ? 'month' : 'year' },
    metadata: { socialshelf_tier: tier, socialshelf_cycle: cycle },
  })
  console.log(`  Preço ${cycle} criado: ${created.id}`)
  return created
}

async function main() {
  const envLines: string[] = []

  for (const plan of PLANS) {
    console.log(`\n${plan.productName}`)
    const product = await findOrCreateProduct(plan.tier, plan.productName)
    const monthly = await findOrCreatePrice(product, plan.tier, 'monthly', plan.monthlyCents)
    const annual = await findOrCreatePrice(product, plan.tier, 'annual', plan.annualCents)
    envLines.push(`${plan.envPrefix}_MONTHLY=${monthly.id}`)
    envLines.push(`${plan.envPrefix}_ANNUAL=${annual.id}`)
  }

  console.log('\n\nCole isto em apps/api/.env (substitui o bloco Stripe de price IDs):\n')
  console.log(envLines.join('\n'))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
