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
