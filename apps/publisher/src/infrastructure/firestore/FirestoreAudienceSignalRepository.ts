import { db } from '../firebase-admin.js'
import type { AudienceSignalRepository, AudienceSignal, Platform } from '@socialshelf/domain'

export class FirestoreAudienceSignalRepository implements AudienceSignalRepository {
  async save(signal: AudienceSignal): Promise<void> {
    await db
      .collection('users')
      .doc(signal.brandId)
      .collection('brands')
      .doc(signal.brandId)
      .collection('audience_signals')
      .doc(signal.id)
      .set({
        ...signal,
        computedAt: signal.computedAt.toISOString(),
      })
  }

  async findLatestByBrandAndPlatform(brandId: string, platform: Platform): Promise<AudienceSignal | null> {
    const snapshot = await db
      .collection('users')
      .doc(brandId)
      .collection('brands')
      .doc(brandId)
      .collection('audience_signals')
      .where('platform', '==', platform)
      .orderBy('computedAt', 'desc')
      .limit(1)
      .get()

    if (snapshot.empty) return null
    return this.fromFirestore(snapshot.docs[0]!.data())
  }

  private fromFirestore(data: FirebaseFirestore.DocumentData): AudienceSignal {
    return {
      id: data['id'] as string,
      brandId: data['brandId'] as string,
      platform: data['platform'] as Platform,
      postsAnalyzed: data['postsAnalyzed'] as number,
      totalImpressions: data['totalImpressions'] as number,
      totalEngagements: data['totalEngagements'] as number,
      avgEngagementRate: data['avgEngagementRate'] as number,
      computedAt: new Date(data['computedAt'] as string),
    }
  }
}
