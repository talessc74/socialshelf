import { db } from '../firebase-admin.js'
import type { AutonomyDailyCounterRepository } from '@socialshelf/domain'

// Um documento por (marca, dia) guarda a contagem de posts publicados pelo modo automático
// naquele dia — não reaproveita o histórico de Post porque não há campo hoje que distinga
// "publicado pelo pipeline automático" de "publicado por ação humana no mesmo dia", e criar
// esse campo mudaria a modelagem de Post para todo o sistema por causa de um contador que
// só o tick de autonomia usa.
export class FirestoreAutonomyDailyCounterRepository implements AutonomyDailyCounterRepository {
  async incrementIfUnderLimit(userId: string, brandId: string, date: string, max: number): Promise<boolean> {
    const ref = db
      .collection('users')
      .doc(userId)
      .collection('brands')
      .doc(brandId)
      .collection('autonomy_daily_counters')
      .doc(date)

    return db.runTransaction(async (tx) => {
      const doc = await tx.get(ref)
      const count = doc.exists ? ((doc.data()!['count'] as number) ?? 0) : 0
      if (count >= max) return false
      tx.set(ref, { count: count + 1 }, { merge: true })
      return true
    })
  }

  async getCount(userId: string, brandId: string, date: string): Promise<number> {
    const ref = db
      .collection('users')
      .doc(userId)
      .collection('brands')
      .doc(brandId)
      .collection('autonomy_daily_counters')
      .doc(date)

    const doc = await ref.get()
    return doc.exists ? ((doc.data()!['count'] as number) ?? 0) : 0
  }
}
