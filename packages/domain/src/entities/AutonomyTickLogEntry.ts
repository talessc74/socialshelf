// Mesmas ações que AutonomyTickUseCase.processBrand pode devolver por marca a cada
// execução do tick — union compartilhada entre quem grava (apps/publisher) e quem lê
// (apps/api) o histórico persistido.
export type AutonomyTickAction =
  | 'skipped-no-platforms'
  | 'skipped-not-yet-time'
  | 'skipped-no-suggestions'
  | 'skipped-blocked'
  | 'skipped-not-eligible'
  | 'skipped-daily-limit'
  // Nível de autonomia (ou maxAutoPostsPerDay) da marca excede o teto do plano de assinatura
  // do usuário — ex.: marca configurada como 'automatic' mas o plano caiu pra 'starter' num
  // downgrade. Reclampado a cada tick, não só ao salvar a marca (_local-adr-policy-0NN, Fase 4c).
  | 'skipped-plan-limit'
  // Saldo de créditos de IA do usuário (mensal, _local-adr-policy-0NN) chegou a zero —
  // substitui o antigo gatilho de teto de gasto diário em R$ (_local-edr-policy-073,
  // descontinuado). Reposto automaticamente no início do próximo mês-calendário.
  | 'skipped-no-credits'
  | 'draft-created'
  | 'published'
  // Publicou em pelo menos uma rede, mas falhou em outra(s) — o motivo de cada falha vai no
  // campo `error`. Sem esta ação, uma publicação parcial ficava registrada como 'published'
  // (sucesso total), escondendo do usuário que Instagram/X/etc. não receberam o post.
  | 'published-partial'
  | 'error'

export interface AutonomyTickLogEntry {
  id: string
  userId: string
  brandId: string
  action: AutonomyTickAction
  topicHeadline: string | null
  error: string | null
  createdAt: Date
}
