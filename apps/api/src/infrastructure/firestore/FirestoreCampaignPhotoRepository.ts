import { db } from '../firebase-admin.js'
import type { CampaignPhotoRepository, CampaignPhoto } from '@socialshelf/domain'

// Fotos sem `order` explícito (enviadas antes dessa feature existir) ordenam depois de
// qualquer foto já reordenada, mantendo entre si a ordem de upload (createdAt) — sort
// estável do V8 preserva a posição relativa de todo empate.
function byOrder(a: CampaignPhoto, b: CampaignPhoto): number {
  if (a.order === null && b.order === null) return 0
  if (a.order === null) return 1
  if (b.order === null) return -1
  return a.order - b.order
}

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
    const snapshot = await db
      .collectionGroup('photos')
      .where('campaignId', '==', campaignId)
      .orderBy('createdAt', 'asc')
      .get()
    return snapshot.docs.map((doc) => this.fromFirestore(doc.data())).sort(byOrder)
  }

  async delete(userId: string, brandId: string, campaignId: string, photoId: string): Promise<CampaignPhoto | null> {
    const ref = this.collectionFor(userId, brandId, campaignId).doc(photoId)
    const doc = await ref.get()
    if (!doc.exists) return null
    const photo = this.fromFirestore(doc.data()!)
    await ref.delete()
    return photo
  }

  async deleteByCampaign(userId: string, brandId: string, campaignId: string): Promise<void> {
    const snapshot = await this.collectionFor(userId, brandId, campaignId).get()
    if (snapshot.empty) return
    const batch = db.batch()
    for (const doc of snapshot.docs) batch.delete(doc.ref)
    await batch.commit()
  }

  async countByCampaign(userId: string, brandId: string, campaignId: string): Promise<number> {
    const snapshot = await this.collectionFor(userId, brandId, campaignId).count().get()
    return snapshot.data().count
  }

  async reorder(userId: string, brandId: string, campaignId: string, orderedPhotoIds: string[]): Promise<void> {
    if (orderedPhotoIds.length === 0) return
    const collection = this.collectionFor(userId, brandId, campaignId)
    const refs = orderedPhotoIds.map((photoId) => collection.doc(photoId))
    // batch.update() exige que o documento já exista — sem checar antes, um id de foto excluída
    // um instante antes (ex: exclusão e arraste-pra-reordenar disparados quase juntos) derruba o
    // lote inteiro com "5 NOT_FOUND: No document to update" (achado real em produção). getAll()
    // busca a existência de todos de uma vez; ids que já não existem só são pulados — a posição
    // dos demais continua correta em relação à ordem pedida.
    const docs = await db.getAll(...refs)
    const batch = db.batch()
    docs.forEach((doc, index) => {
      if (doc.exists) batch.update(refs[index]!, { order: index })
    })
    await batch.commit()
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
      order: (data['order'] as number | null | undefined) ?? null,
      // Fotos enviadas antes da detecção de quase-iguais não têm estes campos — caem em null e
      // nunca são tratadas como duplicata.
      perceptualHash: (data['perceptualHash'] as string | null | undefined) ?? null,
      duplicateOfPhotoId: (data['duplicateOfPhotoId'] as string | null | undefined) ?? null,
      // Fotos enviadas antes da detecção de proporção incompatível também caem no default
      // neutro — nunca tratadas como incompatíveis sem o dado real pra decidir.
      aspectRatio: (data['aspectRatio'] as number | null | undefined) ?? null,
      unsupportedAspectRatio: (data['unsupportedAspectRatio'] as boolean | undefined) ?? false,
    }
  }
}
