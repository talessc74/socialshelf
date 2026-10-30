import type { Subscription } from '../entities/Subscription.js'

export interface SubscriptionRepository {
  findByUserId(userId: string): Promise<Subscription | null>
  save(subscription: Subscription): Promise<void>
}
