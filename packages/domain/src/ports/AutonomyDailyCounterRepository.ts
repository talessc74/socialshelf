export interface AutonomyDailyCounterRepository {
  // Verifica atomicamente o contador de (userId, brandId, date) contra max; se estiver abaixo,
  // incrementa e retorna true. Se já estiver no limite, retorna false sem incrementar — o
  // guardrail de frequência do modo automático (_local-bdr-plan-002, Fase 4) depende dessa
  // atomicidade para não estourar o teto em execuções concorrentes do tick.
  incrementIfUnderLimit(userId: string, brandId: string, date: string, max: number): Promise<boolean>
}
