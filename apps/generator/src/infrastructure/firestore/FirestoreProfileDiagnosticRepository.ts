import { db } from '../firebase-admin.js'
import type { ProfileDiagnosticRepository, ProfileDiagnosticRecord } from '@socialshelf/domain'

export class FirestoreProfileDiagnosticRepository implements ProfileDiagnosticRepository {
  async save(record: ProfileDiagnosticRecord): Promise<void> {
    await db
      .collection('users')
      .doc(record.brandId)
      .collection('brands')
      .doc(record.brandId)
      .collection('profile_diagnostics')
      .doc(record.id)
      .set({
        ...record,
        computedAt: record.computedAt.toISOString(),
      })
  }

  async findLatestByBrand(brandId: string): Promise<ProfileDiagnosticRecord | null> {
    const snapshot = await db
      .collection('users')
      .doc(brandId)
      .collection('brands')
      .doc(brandId)
      .collection('profile_diagnostics')
      .orderBy('computedAt', 'desc')
      .limit(1)
      .get()

    if (snapshot.empty) return null
    return this.fromFirestore(snapshot.docs[0]!.data())
  }

  private fromFirestore(data: FirebaseFirestore.DocumentData): ProfileDiagnosticRecord {
    return {
      id: data['id'] as string,
      brandId: data['brandId'] as string,
      postsAnalyzed: data['postsAnalyzed'] as number,
      diagnostic: data['diagnostic'] as ProfileDiagnosticRecord['diagnostic'],
      computedAt: new Date(data['computedAt'] as string),
    }
  }
}
