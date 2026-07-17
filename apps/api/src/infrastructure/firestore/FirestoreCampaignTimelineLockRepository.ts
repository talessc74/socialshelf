import { db } from '../firebase-admin.js'
import type { CampaignTimelineLockRepository } from '@socialshelf/domain'

// Generoso o bastante pra cobrir o pior caso real (materializar vários itens, com uma chamada
// de legenda por IA cada, ver ExtendCampaignTimelineUseCase), mas curto o bastante pra o lock
// se autorecuperar sozinho se o processo cair no meio de uma execução.
const LOCK_TTL_MS = 2 * 60 * 1000

export class FirestoreCampaignTimelineLockRepository implements CampaignTimelineLockRepository {
  async tryAcquire(userId: string, brandId: string, campaignId: string): Promise<boolean> {
    const ref = this.ref(userId, brandId, campaignId)
    return db.runTransaction(async (tx) => {
      const doc = await tx.get(ref)
      const acquiredAt = doc.exists ? (doc.data()!['acquiredAt'] as string | undefined) : undefined
      const isFree = !acquiredAt || Date.now() - new Date(acquiredAt).getTime() > LOCK_TTL_MS
      if (!isFree) return false
      tx.set(ref, { acquiredAt: new Date().toISOString() })
      return true
    })
  }

  async release(userId: string, brandId: string, campaignId: string): Promise<void> {
    await this.ref(userId, brandId, campaignId).delete()
  }

  private ref(userId: string, brandId: string, campaignId: string) {
    return db
      .collection('users').doc(userId)
      .collection('brands').doc(brandId)
      .collection('photo_campaigns').doc(campaignId)
      .collection('_locks').doc('timeline')
  }
}
