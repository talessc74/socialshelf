import { db } from '../firebase-admin.js'
import type { CreditBalanceRepository, CreditBalance } from '@socialshelf/domain'
import { applyCreditPurchase } from '@socialshelf/domain'

// Documento único por usuário (singleton) — mesmo padrão de subscription/daily_quota
// (_local-adr-policy-0NN). O id fixo 'current' evita precisar de uma query por "o doc mais
// recente"; só existe um CreditBalance por usuário a qualquer momento.
const CREDITS_DOC_ID = 'current'

export class FirestoreCreditBalanceRepository implements CreditBalanceRepository {
  async findByUserId(userId: string): Promise<CreditBalance | null> {
    const doc = await this.creditsRef(userId).get()
    if (!doc.exists) return null
    return this.fromFirestore(doc.data()!)
  }

  async save(balance: CreditBalance): Promise<void> {
    await this.creditsRef(balance.userId).set(this.toFirestore(balance))
  }

  // Transação única: lê o saldo atual de dentro da transação (nunca o que o chamador leu
  // antes, fora dela), aplica `mutate`, grava — garante que duas chamadas concorrentes nunca
  // percam a escrita uma da outra (_local-adr-policy-044).
  async atomicUpdate(
    userId: string,
    mutate: (current: CreditBalance | null) => CreditBalance,
  ): Promise<CreditBalance> {
    const ref = this.creditsRef(userId)
    return db.runTransaction(async (tx) => {
      const doc = await tx.get(ref)
      const current = doc.exists ? this.fromFirestore(doc.data()!) : null
      const next = mutate(current)
      tx.set(ref, this.toFirestore(next))
      return next
    })
  }

  async applyPurchaseOnce(
    userId: string,
    sessionId: string,
    planMonthlyCredits: number | null,
    amount: number,
    now: Date,
  ): Promise<void> {
    const creditsRef = this.creditsRef(userId)
    const dedupRef = db.collection('users').doc(userId).collection('processed_credit_purchases').doc(sessionId)

    await db.runTransaction(async (tx) => {
      // Todas as leituras antes de qualquer escrita — regra do Firestore pra transações.
      const [dedupDoc, creditsDoc] = await Promise.all([tx.get(dedupRef), tx.get(creditsRef)])
      if (dedupDoc.exists) return // já processado nesta sessão de checkout — no-op

      const current = creditsDoc.exists ? this.fromFirestore(creditsDoc.data()!) : null
      const next = applyCreditPurchase(current, userId, planMonthlyCredits, amount, now)
      tx.set(creditsRef, this.toFirestore(next))
      tx.set(dedupRef, { processedAt: now.toISOString() })
    })
  }

  private creditsRef(userId: string): FirebaseFirestore.DocumentReference {
    return db.collection('users').doc(userId).collection('credits').doc(CREDITS_DOC_ID)
  }

  private toFirestore(balance: CreditBalance): FirebaseFirestore.DocumentData {
    return {
      ...balance,
      createdAt: balance.createdAt.toISOString(),
      updatedAt: balance.updatedAt.toISOString(),
    }
  }

  private fromFirestore(data: FirebaseFirestore.DocumentData): CreditBalance {
    return {
      userId: data['userId'] as string,
      periodKey: data['periodKey'] as string,
      planCreditsTotal: (data['planCreditsTotal'] as number) ?? 0,
      planCreditsUsed: (data['planCreditsUsed'] as number) ?? 0,
      purchasedCreditsBalance: (data['purchasedCreditsBalance'] as number) ?? 0,
      createdAt: new Date(data['createdAt'] as string),
      updatedAt: new Date(data['updatedAt'] as string),
    }
  }
}
