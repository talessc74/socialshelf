// Lock advisório contra corrida entre chamadas concorrentes que leem e depois escrevem a linha
// do tempo de uma campanha (GenerateCampaignTimelineUseCase, ExtendCampaignTimelineUseCase,
// ActivateCampaignUseCase) — sem isso, duas chamadas simultâneas podem cada uma calcular o
// mesmo conjunto de "fotos ainda não agendadas" antes de qualquer uma salvar, agendando a
// mesma foto em dois CampaignItems diferentes (achado real em produção: fotos repetidas em
// posts adjacentes de uma campanha ativa).
export interface CampaignTimelineLockRepository {
  /** Tenta adquirir o lock; retorna true se conseguiu (livre, ou lock anterior expirado). */
  tryAcquire(userId: string, brandId: string, campaignId: string): Promise<boolean>
  release(userId: string, brandId: string, campaignId: string): Promise<void>
}
