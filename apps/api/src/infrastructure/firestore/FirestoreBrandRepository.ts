import { db } from '../firebase-admin.js'
import { DEFAULT_ACCOUNT_TYPE, isAccountType } from '@socialshelf/domain'
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

  async findAll(): Promise<Brand[]> {
    const snapshot = await db.collectionGroup('brands').get()
    return snapshot.docs.map((doc) => this.fromFirestore(doc.data()))
  }

  private fromFirestore(data: FirebaseFirestore.DocumentData): Brand {
    // Marcas gravadas antes do accountType existir não têm o campo — caem no default
    // 'professional', preservando o comportamento atual sem migração em lote (_local-adr-policy-030).
    const rawAccountType = data['accountType']
    return {
      id: data['id'] as string,
      userId: data['userId'] as string,
      name: data['name'] as string,
      slug: data['slug'] as string,
      platforms: (data['platforms'] as Platform[]) ?? [],
      accountType: isAccountType(rawAccountType) ? rawAccountType : DEFAULT_ACCOUNT_TYPE,
      createdAt: new Date(data['createdAt'] as string),
      updatedAt: new Date(data['updatedAt'] as string),
    }
  }
}
