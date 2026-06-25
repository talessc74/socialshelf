import { db } from '../firebase-admin.js'
import type { BrandRepository, Brand } from '@socialshelf/domain'
import type { Platform } from '@socialshelf/domain'

export class FirestoreBrandRepository implements BrandRepository {
  async save(brand: Brand): Promise<void> {
    await db
      .collection('users')
      .doc(brand.userId)
      .collection('brands')
      .doc(brand.id)
      .set({
        ...brand,
        createdAt: brand.createdAt.toISOString(),
        updatedAt: brand.updatedAt.toISOString(),
      })
  }

  async findById(userId: string, brandId: string): Promise<Brand | null> {
    const doc = await db
      .collection('users')
      .doc(userId)
      .collection('brands')
      .doc(brandId)
      .get()

    if (!doc.exists) return null
    return this.fromFirestore(doc.data()!)
  }

  async findByUserId(userId: string): Promise<Brand[]> {
    const snapshot = await db
      .collection('users')
      .doc(userId)
      .collection('brands')
      .get()

    return snapshot.docs.map((doc) => this.fromFirestore(doc.data()))
  }

  async delete(userId: string, brandId: string): Promise<void> {
    await db
      .collection('users')
      .doc(userId)
      .collection('brands')
      .doc(brandId)
      .delete()
  }

  private fromFirestore(data: FirebaseFirestore.DocumentData): Brand {
    return {
      id: data['id'] as string,
      userId: data['userId'] as string,
      name: data['name'] as string,
      slug: data['slug'] as string,
      platforms: (data['platforms'] as Platform[]) ?? [],
      createdAt: new Date(data['createdAt'] as string),
      updatedAt: new Date(data['updatedAt'] as string),
    }
  }
}
