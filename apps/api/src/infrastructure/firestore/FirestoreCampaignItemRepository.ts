import { db } from '../firebase-admin.js'
import type { CampaignItemRepository, CampaignItem } from '@socialshelf/domain'

export class FirestoreCampaignItemRepository implements CampaignItemRepository {
  async save(item: CampaignItem): Promise<void> {
    await this.collectionFor(item.userId, item.brandId, item.campaignId).doc(item.id).set(this.toFirestore(item))
  }

  async saveAll(items: CampaignItem[]): Promise<void> {
    if (items.length === 0) return
    const batch = db.batch()
    for (const item of items) {
      const ref = this.collectionFor(item.userId, item.brandId, item.campaignId).doc(item.id)
      batch.set(ref, this.toFirestore(item))
    }
    await batch.commit()
  }

  async findByCampaign(campaignId: string): Promise<CampaignItem[]> {
    const snapshot = await db.collectionGroup('items').where('campaignId', '==', campaignId).orderBy('order').get()
    return snapshot.docs.map((doc) => this.fromFirestore(doc.data()))
  }

  async deleteByCampaign(campaignId: string): Promise<void> {
    // orderBy('order') não muda o resultado (apagamos tudo de qualquer forma) mas garante que
    // esta consulta usa exatamente o mesmo índice composto de findByCampaign, em vez de depender
    // de o Firestore reaproveitar esse índice como prefixo para uma consulta só com igualdade —
    // ver _local-edr-policy-039 pro histórico do bug de índice de campo único nesta mesma coleção.
    const snapshot = await db.collectionGroup('items').where('campaignId', '==', campaignId).orderBy('order').get()
    if (snapshot.empty) return
    const batch = db.batch()
    for (const doc of snapshot.docs) batch.delete(doc.ref)
    await batch.commit()
  }

  private collectionFor(userId: string, brandId: string, campaignId: string) {
    return db
      .collection('users').doc(userId)
      .collection('brands').doc(brandId)
      .collection('photo_campaigns').doc(campaignId)
      .collection('items')
  }

  private toFirestore(item: CampaignItem) {
    return { ...item, scheduledAt: item.scheduledAt.toISOString() }
  }

  private fromFirestore(data: FirebaseFirestore.DocumentData): CampaignItem {
    return {
      id: data['id'] as string,
      userId: data['userId'] as string,
      brandId: data['brandId'] as string,
      campaignId: data['campaignId'] as string,
      order: data['order'] as number,
      photoIds: (data['photoIds'] as string[]) ?? [],
      caption: data['caption'] as string,
      scheduledAt: new Date(data['scheduledAt'] as string),
      status: data['status'] as CampaignItem['status'],
      postId: (data['postId'] as string | null) ?? null,
    }
  }
}
