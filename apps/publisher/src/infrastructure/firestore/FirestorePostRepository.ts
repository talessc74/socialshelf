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

  async findByBrand(brandId: string, status?: PostStatus): Promise<Post[]> {
    let query = db.collectionGroup('posts').where('brandId', '==', brandId)
    if (status) query = query.where('status', '==', status)
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
      content: (data['content'] as Post['content']) ?? [],
      imageStoragePaths: (data['imageStoragePaths'] as string[]) ?? [],
      status: data['status'] as PostStatus,
      scheduledAt: data['scheduledAt'] ? new Date(data['scheduledAt'] as string) : null,
      publishedAt: data['publishedAt'] ? new Date(data['publishedAt'] as string) : null,
      externalIds: (data['externalIds'] as Partial<Record<Platform, string>>) ?? {},
      createdAt: new Date(data['createdAt'] as string),
      updatedAt: new Date(data['updatedAt'] as string),
    }
  }
}
