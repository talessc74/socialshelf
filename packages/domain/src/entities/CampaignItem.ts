export type CampaignItemStatus = 'planned' | 'materialized'

// Um item da linha do tempo de uma campanha: uma foto sozinha (post simples) ou um grupo de
// fotos (carrossel). Enquanto 'planned', é só planejamento — nenhum Post existe ainda, então
// editar aqui (reordenar, trocar legenda, mudar agrupamento) não afeta nada publicado.
export interface CampaignItem {
  id: string
  userId: string
  brandId: string
  campaignId: string
  order: number
  photoIds: string[]
  caption: string
  scheduledAt: Date
  status: CampaignItemStatus
  // Preenchido por ActivateCampaignUseCase com o id do Post real materializado.
  postId: string | null
}
