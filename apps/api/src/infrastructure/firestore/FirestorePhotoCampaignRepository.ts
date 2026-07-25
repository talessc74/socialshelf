import { db } from '../firebase-admin.js'
import type { PhotoCampaignRepository, PhotoCampaign } from '@socialshelf/domain'

export class FirestorePhotoCampaignRepository implements PhotoCampaignRepository {
  async save(campaign: PhotoCampaign): Promise<void> {
    await db
      .collection('users')
      .doc(campaign.userId)
      .collection('brands')
      .doc(campaign.brandId)
      .collection('photo_campaigns')
      .doc(campaign.id)
      .set({
        ...campaign,
        createdAt: campaign.createdAt.toISOString(),
        updatedAt: campaign.updatedAt.toISOString(),
        startedAt: campaign.startedAt?.toISOString() ?? null,
        completedAt: campaign.completedAt?.toISOString() ?? null,
        photosDeletedAt: campaign.photosDeletedAt?.toISOString() ?? null,
      })
  }

  async findById(id: string): Promise<PhotoCampaign | null> {
    // orderBy garante um índice composto de verdade em vez de um filtro de campo único de
    // escopo COLLECTION_GROUP — ver _local-edr-policy-039 pro histórico desse bug.
    const snapshot = await db
      .collectionGroup('photo_campaigns')
      .where('id', '==', id)
      .orderBy('createdAt')
      .limit(1)
      .get()
    if (snapshot.empty) return null
    return this.fromFirestore(snapshot.docs[0]!.data())
  }

  async findByIdAndBrand(id: string, userId: string, brandId: string): Promise<PhotoCampaign | null> {
    const doc = await db
      .collection('users').doc(userId)
      .collection('brands').doc(brandId)
      .collection('photo_campaigns').doc(id)
      .get()

    if (!doc.exists) return null
    return this.fromFirestore(doc.data()!)
  }

  async findByBrand(userId: string, brandId: string): Promise<PhotoCampaign[]> {
    const snapshot = await db
      .collection('users').doc(userId)
      .collection('brands').doc(brandId)
      .collection('photo_campaigns')
      .orderBy('createdAt', 'desc')
      .get()

    return snapshot.docs.map((doc) => this.fromFirestore(doc.data()))
  }

  async findCancelledForPhotoCleanup(cutoff: Date): Promise<PhotoCampaign[]> {
    const snapshot = await db
      .collectionGroup('photo_campaigns')
      .where('status', '==', 'cancelled')
      .where('updatedAt', '<=', cutoff.toISOString())
      .get()

    return snapshot.docs
      .map((doc) => this.fromFirestore(doc.data()))
      .filter((campaign) => campaign.photosDeletedAt === null)
  }

  async delete(userId: string, brandId: string, id: string): Promise<void> {
    await db
      .collection('users').doc(userId)
      .collection('brands').doc(brandId)
      .collection('photo_campaigns').doc(id)
      .delete()
  }

  private fromFirestore(data: FirebaseFirestore.DocumentData): PhotoCampaign {
    return {
      id: data['id'] as string,
      userId: data['userId'] as string,
      brandId: data['brandId'] as string,
      name: data['name'] as string,
      description: data['description'] as string,
      keywords: (data['keywords'] as string[]) ?? [],
      platforms: (data['platforms'] as PhotoCampaign['platforms']) ?? [],
      postsPerDay: data['postsPerDay'] as number,
      carouselSizeDefault: data['carouselSizeDefault'] as number,
      status: data['status'] as PhotoCampaign['status'],
      createdAt: new Date(data['createdAt'] as string),
      updatedAt: new Date(data['updatedAt'] as string),
      startedAt: data['startedAt'] ? new Date(data['startedAt'] as string) : null,
      completedAt: data['completedAt'] ? new Date(data['completedAt'] as string) : null,
      photosDeletedAt: data['photosDeletedAt'] ? new Date(data['photosDeletedAt'] as string) : null,
    }
  }
}
