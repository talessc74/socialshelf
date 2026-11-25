import type { Subscription } from '../entities/Subscription.js'

export interface SubscriptionRepository {
  findByUserId(userId: string): Promise<Subscription | null>
  // Usado só pra detectar reuso de cartão entre contas diferentes no teste grátis
  // (_local-adr-policy-0NN) — varre todos os usuários (collection group), não só um.
  findByCardFingerprint(fingerprint: string): Promise<Subscription[]>
  save(subscription: Subscription): Promise<void>
}
