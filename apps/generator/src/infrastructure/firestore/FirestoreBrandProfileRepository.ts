import { db } from '../firebase-admin.js'
import type { BrandProfileRepository, BrandProfile } from '@socialshelf/domain'

export class FirestoreBrandProfileRepository implements BrandProfileRepository {
  async save(profile: BrandProfile): Promise<void> {
    await db
      .collection('users')
      .doc(profile.userId)
      .collection('brands')
      .doc(profile.brandId)
      .collection('brand_profiles')
      .doc(`v${profile.version}`)
      .set({
        ...profile,
        createdAt: profile.createdAt.toISOString(),
      })
  }

  async findLatestByBrand(brandId: string): Promise<BrandProfile | null> {
    const snapshot = await db
      .collection('users')
      .doc(brandId)
      .collection('brands')
      .doc(brandId)
      .collection('brand_profiles')
      .orderBy('version', 'desc')
      .limit(1)
      .get()

    if (snapshot.empty) return null
    return this.fromFirestore(snapshot.docs[0]!.data())
  }

  async findByBrandAndVersion(brandId: string, version: number): Promise<BrandProfile | null> {
    const doc = await db
      .collection('users')
      .doc(brandId)
      .collection('brands')
      .doc(brandId)
      .collection('brand_profiles')
      .doc(`v${version}`)
      .get()

    if (!doc.exists) return null
    return this.fromFirestore(doc.data()!)
  }

  private fromFirestore(data: FirebaseFirestore.DocumentData): BrandProfile {
    return {
      id: data['id'] as string,
      userId: data['userId'] as string,
      brandId: data['brandId'] as string,
      version: data['version'] as number,
      business: data['business'] as BrandProfile['business'],
      identity: data['identity'] as BrandProfile['identity'],
      visual: data['visual'] as BrandProfile['visual'],
      voice: data['voice'] as BrandProfile['voice'],
      narrative: data['narrative'] as BrandProfile['narrative'],
      operation: data['operation'] as BrandProfile['operation'],
      createdAt: new Date(data['createdAt'] as string),
    }
  }
}
