import { db } from '../firebase-admin.js'
import type {
  GenerationRequestRepository,
  GenerationRequest,
  GenerationStatus,
} from '@socialshelf/domain'

export class FirestoreGenerationRequestRepository implements GenerationRequestRepository {
  private collection(userId: string, brandId: string) {
    return db
      .collection('users').doc(userId)
      .collection('brands').doc(brandId)
      .collection('generation_requests')
  }

  async save(request: GenerationRequest): Promise<void> {
    await this.collection(request.userId, request.brandId)
      .doc(request.id)
      .set({
        ...request,
        createdAt: request.createdAt.toISOString(),
        updatedAt: request.updatedAt.toISOString(),
      })
  }

  async findById(id: string): Promise<GenerationRequest | null> {
    const snapshot = await db
      .collectionGroup('generation_requests')
      .where('id', '==', id)
      .limit(1)
      .get()

    if (snapshot.empty) return null
    return this.fromFirestore(snapshot.docs[0]!.data())
  }

  async updateStatus(id: string, status: GenerationStatus, error?: string): Promise<void> {
    const snapshot = await db
      .collectionGroup('generation_requests')
      .where('id', '==', id)
      .limit(1)
      .get()

    if (snapshot.empty) return
    await snapshot.docs[0]!.ref.update({
      status,
      error: error ?? null,
      updatedAt: new Date().toISOString(),
    })
  }

  async updateOutputs(id: string, outputs: NonNullable<GenerationRequest['outputs']>): Promise<void> {
    const snapshot = await db
      .collectionGroup('generation_requests')
      .where('id', '==', id)
      .limit(1)
      .get()

    if (snapshot.empty) return
    await snapshot.docs[0]!.ref.update({
      outputs,
      updatedAt: new Date().toISOString(),
    })
  }

  async delete(id: string): Promise<void> {
    const snapshot = await db
      .collectionGroup('generation_requests')
      .where('id', '==', id)
      .limit(1)
      .get()

    if (!snapshot.empty) {
      await snapshot.docs[0]!.ref.delete()
    }
  }

  private fromFirestore(data: FirebaseFirestore.DocumentData): GenerationRequest {
    return {
      id: data['id'] as string,
      userId: data['userId'] as string,
      brandId: data['brandId'] as string,
      status: data['status'] as GenerationStatus,
      inputs: data['inputs'] as GenerationRequest['inputs'],
      outputs: (data['outputs'] as GenerationRequest['outputs']) ?? null,
      error: (data['error'] as string | null) ?? null,
      createdAt: new Date(data['createdAt'] as string),
      updatedAt: new Date(data['updatedAt'] as string),
    }
  }
}
