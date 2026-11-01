import { db } from '../firebase-admin.js'
import type { CreditBalanceRepository, CreditBalance } from '@socialshelf/domain'

// Documento único por usuário (singleton) — mesmo padrão de subscription/daily_quota
// (_local-adr-policy-0NN). O id fixo 'current' evita precisar de uma query por "o doc mais
// recente"; só existe um CreditBalance por usuário a qualquer momento.
const CREDITS_DOC_ID = 'current'

export class FirestoreCreditBalanceRepository implements CreditBalanceRepository {
  async findByUserId(userId: string): Promise<CreditBalance | null> {
    const doc = await db.collection('users').doc(userId).collection('credits').doc(CREDITS_DOC_ID).get()

    if (!doc.exists) return null
    return this.fromFirestore(doc.data()!)
  }

  async save(balance: CreditBalance): Promise<void> {
    await db
      .collection('users')
      .doc(balance.userId)
      .collection('credits')
      .doc(CREDITS_DOC_ID)
      .set({
        ...balance,
        createdAt: balance.createdAt.toISOString(),
        updatedAt: balance.updatedAt.toISOString(),
      })
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
