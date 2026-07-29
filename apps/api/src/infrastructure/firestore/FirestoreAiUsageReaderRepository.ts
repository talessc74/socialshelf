import { db } from '../firebase-admin.js'
import type { AiUsageReaderPort, AiUsageEvent, AiUsageCategory } from '@socialshelf/domain'

// Lê users/{userId}/brands/{brandId}/ai_usage_events, escrito pelo generator-service
// (FirestoreAiUsageRepository).
export class FirestoreAiUsageReaderRepository implements AiUsageReaderPort {
  // Todas as contas via collectionGroup — só para a tela de admin de gastos
  // (_local-edr-policy-072). Sem where/orderBy: o volume ainda é baixo o suficiente para
  // agregar em memória no use-case, e uma listagem simples de collection group não exige
  // nenhum índice composto novo (só where/orderBy combinados exigem).
  async findAll(): Promise<AiUsageEvent[]> {
    const snapshot = await db.collectionGroup('ai_usage_events').get()
    return snapshot.docs.map((doc) => this.fromFirestore(doc.id, doc.data()))
  }

  // Uma única marca, direto na subcoleção (sem collectionGroup) — usada pela tela de gasto da
  // própria conta (_local-edr-policy-073), acessível pelo próprio dono via autenticação normal.
  async findByBrand(userId: string, brandId: string): Promise<AiUsageEvent[]> {
    const snapshot = await db
      .collection('users')
      .doc(userId)
      .collection('brands')
      .doc(brandId)
      .collection('ai_usage_events')
      .get()
    return snapshot.docs.map((doc) => this.fromFirestore(doc.id, doc.data()))
  }

  private fromFirestore(id: string, data: FirebaseFirestore.DocumentData): AiUsageEvent {
    return {
      id,
      userId: data['userId'] as string,
      brandId: data['brandId'] as string,
      category: data['category'] as AiUsageCategory,
      operation: data['operation'] as string,
      model: data['model'] as string,
      promptTokenCount: (data['promptTokenCount'] as number | null) ?? null,
      candidatesTokenCount: (data['candidatesTokenCount'] as number | null) ?? null,
      thoughtsTokenCount: (data['thoughtsTokenCount'] as number | null) ?? null,
      imageCount: (data['imageCount'] as number | null) ?? null,
      estimatedCostUsd: data['estimatedCostUsd'] as number,
      createdAt: new Date(data['createdAt'] as string),
    }
  }
}
