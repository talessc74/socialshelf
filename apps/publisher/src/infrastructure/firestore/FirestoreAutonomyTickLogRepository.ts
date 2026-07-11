import { db } from '../firebase-admin.js'
import type { AutonomyTickLogRepository, AutonomyTickLogEntry, AutonomyTickAction } from '@socialshelf/domain'

// Um documento por tentativa do tick por marca — subcoleção direta (não collectionGroup),
// então o orderBy('createdAt') abaixo não exige nenhum índice composto novo, ao contrário do
// que aconteceu com CampaignPhoto/CampaignItem (_local-edr-policy-039/042).
export class FirestoreAutonomyTickLogRepository implements AutonomyTickLogRepository {
  private collection(userId: string, brandId: string) {
    return db
      .collection('users')
      .doc(userId)
      .collection('brands')
      .doc(brandId)
      .collection('autonomy_tick_log')
  }

  async save(entry: AutonomyTickLogEntry): Promise<void> {
    await this.collection(entry.userId, entry.brandId)
      .doc(entry.id)
      .set({
        action: entry.action,
        topicHeadline: entry.topicHeadline,
        error: entry.error,
        createdAt: entry.createdAt.toISOString(),
      })
  }

  async findRecentByBrand(userId: string, brandId: string, limit: number): Promise<AutonomyTickLogEntry[]> {
    const snap = await this.collection(userId, brandId).orderBy('createdAt', 'desc').limit(limit).get()
    return snap.docs.map((doc) => {
      const data = doc.data()
      return {
        id: doc.id,
        userId,
        brandId,
        action: data['action'] as AutonomyTickAction,
        topicHeadline: (data['topicHeadline'] as string | null) ?? null,
        error: (data['error'] as string | null) ?? null,
        createdAt: new Date(data['createdAt'] as string),
      }
    })
  }
}
