import { db } from '../firebase-admin.js'
import type { SubscriptionRepository, Subscription } from '@socialshelf/domain'

// Documento único por usuário (singleton) — mesmo padrão de ai_consent/daily_quota
// (_local-adr-policy-0NN). O id fixo 'current' evita precisar de uma query por "o doc mais
// recente"; só existe um Subscription por usuário a qualquer momento.
const SUBSCRIPTION_DOC_ID = 'current'

export class FirestoreSubscriptionRepository implements SubscriptionRepository {
  async findByUserId(userId: string): Promise<Subscription | null> {
    const doc = await db.collection('users').doc(userId).collection('subscription').doc(SUBSCRIPTION_DOC_ID).get()

    if (!doc.exists) return null
    return this.fromFirestore(doc.data()!)
  }

  async save(subscription: Subscription): Promise<void> {
    await db
      .collection('users')
      .doc(subscription.userId)
      .collection('subscription')
      .doc(SUBSCRIPTION_DOC_ID)
      .set({
        ...subscription,
        billingCycle: subscription.billingCycle,
        // undefined (campo opcional nunca setado) viraria erro no Firestore — normaliza pra
        // null, mesmo tratamento dos outros campos opcionais aqui.
        cardFingerprint: subscription.cardFingerprint ?? null,
        trialEndsAt: subscription.trialEndsAt?.toISOString() ?? null,
        currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
        createdAt: subscription.createdAt.toISOString(),
        updatedAt: subscription.updatedAt.toISOString(),
      })
  }

  // Usado só pra detectar reuso de cartão entre contas diferentes no teste grátis
  // (_local-adr-policy-0NN) — collection group, não um `where` dentro de um usuário, porque o
  // reuso é exatamente entre userIds diferentes. Exige o índice declarado em
  // firestore.indexes.json (collectionGroup "subscription", campo cardFingerprint).
  async findByCardFingerprint(fingerprint: string): Promise<Subscription[]> {
    const snapshot = await db.collectionGroup('subscription').where('cardFingerprint', '==', fingerprint).get()
    return snapshot.docs.map((doc) => this.fromFirestore(doc.data()))
  }

  private fromFirestore(data: FirebaseFirestore.DocumentData): Subscription {
    return {
      userId: data['userId'] as string,
      tier: data['tier'] as Subscription['tier'],
      billingCycle: (data['billingCycle'] as Subscription['billingCycle']) ?? null,
      status: data['status'] as Subscription['status'],
      stripeCustomerId: (data['stripeCustomerId'] as string | null) ?? null,
      stripeSubscriptionId: (data['stripeSubscriptionId'] as string | null) ?? null,
      additionalProfessionalBrands: (data['additionalProfessionalBrands'] as number) ?? 0,
      adminOverrideUnlimited: (data['adminOverrideUnlimited'] as boolean) ?? false,
      cardFingerprint: (data['cardFingerprint'] as string | null | undefined) ?? null,
      trialEndsAt: data['trialEndsAt'] ? new Date(data['trialEndsAt'] as string) : null,
      currentPeriodEnd: data['currentPeriodEnd'] ? new Date(data['currentPeriodEnd'] as string) : null,
      cancelAtPeriodEnd: (data['cancelAtPeriodEnd'] as boolean) ?? false,
      createdAt: new Date(data['createdAt'] as string),
      updatedAt: new Date(data['updatedAt'] as string),
    }
  }
}
