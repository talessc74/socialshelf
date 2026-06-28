import { db } from '../firebase-admin.js'
import type { PostRepository, Post, PostStatus } from '@socialshelf/domain'
import { Platform } from '@socialshelf/domain'

export class FirestorePostRepository implements PostRepository {
  async save(post: Post): Promise<void> {
    await db
      .collection('users')
      .doc(post.userId)
      .collection('brands')
      .doc(post.brandId)
      .collection('posts')
      .doc(post.id)
      .set({
        ...post,
        scheduledAt: post.scheduledAt?.toISOString() ?? null,
        publishedAt: post.publishedAt?.toISOString() ?? null,
        createdAt: post.createdAt.toISOString(),
        updatedAt: post.updatedAt.toISOString(),
      })
  }

  async findById(id: string): Promise<Post | null> {
    const snapshot = await db
      .collectionGroup('posts')
      .where('id', '==', id)
      .limit(1)
      .get()

    if (snapshot.empty) return null
    return this.fromFirestore(snapshot.docs[0]!.data())
  }

  async findByIdAndBrand(id: string, userId: string, brandId: string): Promise<Post | null> {
    const doc = await db
      .collection('users').doc(userId)
      .collection('brands').doc(brandId)
      .collection('posts').doc(id)
      .get()

    if (!doc.exists) return null
    return this.fromFirestore(doc.data()!)
  }

  async findByBrand(_userId: string, brandId: string, status?: PostStatus): Promise<Post[]> {
    let query: FirebaseFirestore.Query = db.collectionGroup('posts').where('brandId', '==', brandId)
    // O orderBy aproveita o índice composto (brandId, status, createdAt) já provisionado
    // em produção — sem ele, o Firestore exige um índice diferente (sem createdAt) para
    // esta mesma consulta, que não existe.
    if (status) query = query.where('status', '==', status).orderBy('createdAt', 'desc')
    const snapshot = await query.get()
    return snapshot.docs.map((doc) => this.fromFirestore(doc.data()))
  }

  async findScheduledBefore(cutoff: Date): Promise<Post[]> {
    const snapshot = await db
      .collectionGroup('posts')
      .where('status', '==', 'scheduled')
      .where('scheduledAt', '<=', cutoff.toISOString())
      .get()

    return snapshot.docs.map((doc) => this.fromFirestore(doc.data()))
  }

  async claimForPublishing(id: string, userId: string, brandId: string): Promise<Post | null> {
    const ref = db
      .collection('users').doc(userId)
      .collection('brands').doc(brandId)
      .collection('posts').doc(id)

    return db.runTransaction(async (tx) => {
      const doc = await tx.get(ref)
      if (!doc.exists) return null

      const post = this.fromFirestore(doc.data()!)
      // Already locked by a concurrent claim or already published: refuse to claim again.
      if (post.status === 'publishing' || post.status === 'published') return null

      tx.update(ref, { status: 'publishing', updatedAt: new Date().toISOString() })
      return { ...post, status: 'publishing' }
    })
  }

  async delete(id: string): Promise<void> {
    const snapshot = await db
      .collectionGroup('posts')
      .where('id', '==', id)
      .limit(1)
      .get()

    if (!snapshot.empty) {
      await snapshot.docs[0]!.ref.delete()
    }
  }

  private fromFirestore(data: FirebaseFirestore.DocumentData): Post {
    return {
      id: data['id'] as string,
      userId: data['userId'] as string,
      brandId: data['brandId'] as string,
      brandProfileVersion: (data['brandProfileVersion'] as number | null) ?? null,
      content: (data['content'] as Post['content']) ?? [],
      imageStoragePaths: (data['imageStoragePaths'] as string[]) ?? [],
      status: data['status'] as PostStatus,
      scheduledAt: data['scheduledAt'] ? new Date(data['scheduledAt'] as string) : null,
      publishedAt: data['publishedAt'] ? new Date(data['publishedAt'] as string) : null,
      externalIds: (data['externalIds'] as Partial<Record<Platform, string>>) ?? {},
      sourceArticleUrl: (data['sourceArticleUrl'] as string | null | undefined) ?? null,
      createdAt: new Date(data['createdAt'] as string),
      updatedAt: new Date(data['updatedAt'] as string),
    }
  }
}
