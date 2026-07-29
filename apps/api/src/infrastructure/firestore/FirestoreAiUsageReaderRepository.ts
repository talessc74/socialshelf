import { db } from '../firebase-admin.js'
import type { AiUsageReaderPort, AiUsageEvent, AiUsageCategory } from '@socialshelf/domain'

// Lê users/{userId}/brands/{brandId}/ai_usage_events via collectionGroup, escrito pelo
// generator-service (FirestoreAiUsageRepository) — só para a tela de admin de gastos
// (_local-edr-policy-072). Sem where/orderBy: o volume ainda é baixo o suficiente para agregar
// em memória no use-case, e uma listagem simples de collection group não exige nenhum índice
// composto novo (só where/orderBy combinados exigem).
export class FirestoreAiUsageReaderRepository implements AiUsageReaderPort {
  async findAll(): Promise<AiUsageEvent[]> {
    const snapshot = await db.collectionGroup('ai_usage_events').get()
    return snapshot.docs.map((doc) => {
      const data = doc.data()
      return {
        id: doc.id,
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
    })
  }
}
