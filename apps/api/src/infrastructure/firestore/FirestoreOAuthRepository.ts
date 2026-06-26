import { db } from '../firebase-admin.js'
import type { OAuthRepository, OAuthConnection } from '@socialshelf/domain'
import { Platform } from '@socialshelf/domain'

export class FirestoreOAuthRepository implements OAuthRepository {
  async save(connection: OAuthConnection): Promise<void> {
    await db
      .collection('users')
      .doc(connection.userId)
      .collection('brands')
      .doc(connection.brandId)
      .collection('oauth_connections')
      .doc(connection.pairwiseId)
      .set({
        ...connection,
        expiresAt: connection.expiresAt?.toISOString() ?? null,
        createdAt: connection.createdAt.toISOString(),
        updatedAt: connection.updatedAt.toISOString(),
      })
  }

  async findById(id: string): Promise<OAuthConnection | null> {
    const snapshot = await db
      .collectionGroup('oauth_connections')
      .where('id', '==', id)
      .limit(1)
      .get()

    if (snapshot.empty) return null
    return this.fromFirestore(snapshot.docs[0]!.data())
  }

  async findByPairwise(pairwiseId: string): Promise<OAuthConnection | null> {
    const snapshot = await db
      .collectionGroup('oauth_connections')
      .where('pairwiseId', '==', pairwiseId)
      .limit(1)
      .get()

    if (snapshot.empty) return null
    return this.fromFirestore(snapshot.docs[0]!.data())
  }

  async findByBrandAndPlatform(
    userId: string,
    brandId: string,
    platform: Platform,
  ): Promise<OAuthConnection | null> {
    const snapshot = await db
      .collection('users').doc(userId)
      .collection('brands').doc(brandId)
      .collection('oauth_connections')
      .where('platform', '==', platform)
      .limit(1)
      .get()

    if (snapshot.empty) return null
    return this.fromFirestore(snapshot.docs[0]!.data())
  }

  async findByBrand(userId: string, brandId: string): Promise<OAuthConnection[]> {
    const snapshot = await db
      .collection('users').doc(userId)
      .collection('brands').doc(brandId)
      .collection('oauth_connections')
      .get()

    const all = snapshot.docs.map((doc) => this.fromFirestore(doc.data()))
    const byPlatform = new Map<string, OAuthConnection>()
    for (const conn of all) {
      const existing = byPlatform.get(conn.platform)
      if (!existing || conn.updatedAt > existing.updatedAt) {
        byPlatform.set(conn.platform, conn)
      }
    }
    return [...byPlatform.values()]
  }

  async delete(id: string): Promise<void> {
    const snapshot = await db
      .collectionGroup('oauth_connections')
      .where('id', '==', id)
      .limit(1)
      .get()

    if (!snapshot.empty) {
      await snapshot.docs[0]!.ref.delete()
    }
  }

  private fromFirestore(data: FirebaseFirestore.DocumentData): OAuthConnection {
    return {
      id: data['id'] as string,
      userId: data['userId'] as string,
      brandId: data['brandId'] as string,
      platform: (data['platform'] as string).toLowerCase() as Platform,
      pairwiseId: data['pairwiseId'] as string,
      tokenRef: data['tokenRef'] as string,
      scopes: data['scopes'] as string[],
      organizationUrn: (data['organizationUrn'] as string | null | undefined) ?? null,
      expiresAt: data['expiresAt'] ? new Date(data['expiresAt'] as string) : null,
      createdAt: new Date(data['createdAt'] as string),
      updatedAt: new Date(data['updatedAt'] as string),
    }
  }
}
