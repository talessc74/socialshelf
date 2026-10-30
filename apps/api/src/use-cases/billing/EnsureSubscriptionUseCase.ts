import { isAdminEmail } from '@socialshelf/domain'
import type { Subscription, SubscriptionRepository, BrandRepository } from '@socialshelf/domain'

// Data de corte do lançamento do billing (_local-adr-policy-0NN, Fase 6) — qualquer usuário
// cuja marca mais antiga é anterior a esta data vira 'legacy' (ilimitado, permanente, decisão
// de negócio). Quem se cadastra depois cai em 'free'. Ajustar só se o lançamento real mudar de
// data — não é um valor operacional, é um marco histórico fixo.
export const BILLING_CUTOVER_DATE = new Date('2026-11-01T00:00:00Z')

// Cria o Subscription de um usuário na primeira vez que ele é necessário (espelha
// ensureDefaultBrand em brands.routes.ts). É o único lugar do sistema que consulta
// isAdminEmail para fins de billing — todo o resto lê adminOverrideUnlimited já persistido
// (_local-adr-policy-0NN, Fase 5).
export class EnsureSubscriptionUseCase {
  constructor(
    private readonly subscriptionRepo: SubscriptionRepository,
    private readonly brandRepo: BrandRepository,
  ) {}

  async execute(userId: string, userEmail: string | null): Promise<Subscription> {
    const existing = await this.subscriptionRepo.findByUserId(userId)
    if (existing) return existing

    const brands = await this.brandRepo.findByUserId(userId)
    const earliestBrandCreatedAt = brands.reduce<Date | null>((earliest, brand) => {
      if (!earliest || brand.createdAt < earliest) return brand.createdAt
      return earliest
    }, null)

    // Sem marca nenhuma, ou toda marca criada depois do corte: usuário novo, plano Grátis.
    // Alguma marca anterior ao corte: usuário que já usava o produto, plano legado.
    const tier = earliestBrandCreatedAt && earliestBrandCreatedAt < BILLING_CUTOVER_DATE ? 'legacy' : 'free'

    const now = new Date()
    const subscription: Subscription = {
      userId,
      tier,
      billingCycle: null,
      status: 'active',
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      additionalProfessionalBrands: 0,
      adminOverrideUnlimited: isAdminEmail(userEmail),
      trialEndsAt: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      createdAt: now,
      updatedAt: now,
    }
    await this.subscriptionRepo.save(subscription)
    return subscription
  }
}
