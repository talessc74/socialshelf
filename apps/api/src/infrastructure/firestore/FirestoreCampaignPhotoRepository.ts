import { db } from '../firebase-admin.js'
import type { CampaignPhotoRepository, CampaignPhoto } from '@socialshelf/domain'

export class FirestoreCampaignPhotoRepository implements CampaignPhotoRepository {
  async save(photo: CampaignPhoto): Promise<void> {
    await this.collectionFor(photo.userId, photo.brandId, photo.campaignId).doc(photo.id).set(this.toFirestore(photo))
  }

  async saveAll(photos: CampaignPhoto[]): Promise<void> {
    if (photos.length === 0) return
    const batch = db.batch()
    for (const photo of photos) {
      const ref = this.collectionFor(photo.userId, photo.brandId, photo.campaignId).doc(photo.id)
      batch.set(ref, this.toFirestore(photo))
    }
    await batch.commit()
  }

  async findByCampaign(campaignId: string): Promise<CampaignPhoto[]> {
    const snapshot = await db.collectionGroup('photos').where('campaignId', '==', campaignId).get()
    return snapshot.docs.map((doc) => this.fromFirestore(doc.data()))
  }

  private collectionFor(userId: string, brandId: string, campaignId: string) {
    return db
      .collection('users').doc(userId)
      .collection('brands').doc(brandId)
      .collection('photo_campaigns').doc(campaignId)
      .collection('photos')
  }

  private toFirestore(photo: CampaignPhoto) {
    return {
      ...photo,
      exifTakenAt: photo.exifTakenAt?.toISOString() ?? null,
      createdAt: photo.createdAt.toISOString(),
    }
  }

  private fromFirestore(data: FirebaseFirestore.DocumentData): CampaignPhoto {
    return {
      id: data['id'] as string,
      userId: data['userId'] as string,
      brandId: data['brandId'] as string,
      campaignId: data['campaignId'] as string,
      storagePath: data['storagePath'] as string,
      exifTakenAt: data['exifTakenAt'] ? new Date(data['exifTakenAt'] as string) : null,
      gpsLat: (data['gpsLat'] as number | null) ?? null,
      gpsLng: (data['gpsLng'] as number | null) ?? null,
      locationClusterId: (data['locationClusterId'] as string | null) ?? null,
      createdAt: new Date(data['createdAt'] as string),
    }
  }
}
