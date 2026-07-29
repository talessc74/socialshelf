import { randomUUID } from 'node:crypto'
import { db } from '../firebase-admin.js'
import type { AiUsageRecorderPort, AiSpendingGuardPort, NewAiUsageEvent } from '@socialshelf/domain'

// Mesma nested collection users/{userId}/brands/{brandId}/... já usada por generation_requests
// e afins — consultada via collectionGroup(brandId + createdAt), mesmo índice composto de
// generation_requests em firestore.indexes.json.
//
// record() NUNCA lança — medir uso é observabilidade, uma falha de gravação (rede, permissão,
// índice faltando) não pode derrubar uma geração de conteúdo real. Erros só vão pro console.
//
// sumCostUsdSince() (AiSpendingGuardPort) é diferente: ela É o mecanismo de execução da trava
// de gasto, então PODE lançar — quem chama decide como falhar (o chamador atual trata erro
// como "sem gasto ainda", fail-open, pra uma falha transitória de leitura nunca travar quem
// nunca passou do limite de verdade).
export class FirestoreAiUsageRepository implements AiUsageRecorderPort, AiSpendingGuardPort {
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

  async sumCostUsdSince(userId: string, brandId: string, since: Date): Promise<number> {
    const snapshot = await db
      .collection('users')
      .doc(userId)
      .collection('brands')
      .doc(brandId)
      .collection('ai_usage_events')
      .where('createdAt', '>=', since.toISOString())
      .get()

    return snapshot.docs.reduce((sum, doc) => sum + ((doc.data()['estimatedCostUsd'] as number | undefined) ?? 0), 0)
  }
}
