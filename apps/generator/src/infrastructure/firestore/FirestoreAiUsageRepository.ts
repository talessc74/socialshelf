import { randomUUID } from 'node:crypto'
import { db } from '../firebase-admin.js'
import type { AiUsageRecorderPort, NewAiUsageEvent } from '@socialshelf/domain'

// Mesma nested collection users/{userId}/brands/{brandId}/... já usada por generation_requests
// e afins — consultada via collectionGroup(brandId + createdAt), mesmo índice composto de
// generation_requests em firestore.indexes.json.
//
// record() NUNCA lança — medir uso é observabilidade, uma falha de gravação (rede, permissão,
// índice faltando) não pode derrubar uma geração de conteúdo real. Erros só vão pro console.
export class FirestoreAiUsageRepository implements AiUsageRecorderPort {
  async record(event: NewAiUsageEvent): Promise<void> {
    try {
      await db
        .collection('users')
        .doc(event.userId)
        .collection('brands')
        .doc(event.brandId)
        .collection('ai_usage_events')
        .doc(randomUUID())
        .set({
          userId: event.userId,
          brandId: event.brandId,
          category: event.category,
          operation: event.operation,
          model: event.model,
          promptTokenCount: event.promptTokenCount ?? null,
          candidatesTokenCount: event.candidatesTokenCount ?? null,
          thoughtsTokenCount: event.thoughtsTokenCount ?? null,
          imageCount: event.imageCount ?? null,
          estimatedCostUsd: event.estimatedCostUsd,
          createdAt: new Date().toISOString(),
        })
    } catch (err) {
      console.error('Failed to record AI usage event', err)
    }
  }
}
