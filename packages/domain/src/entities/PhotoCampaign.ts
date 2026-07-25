import type { Platform } from './Platform.js'

// 'paused': campanha ativa que o usuário parou temporariamente — os Posts ainda não publicados
// são desfeitos (ver cancelPendingCampaignPosts) e os itens correspondentes voltam a 'planned',
// prontos pra ganhar novas datas quando ResumeCampaignUseCase reagendar a partir de agora.
export type PhotoCampaignStatus = 'draft' | 'reviewing' | 'active' | 'paused' | 'completed' | 'cancelled'

export interface PhotoCampaign {
  id: string
  userId: string
  brandId: string
  name: string
  description: string
  keywords: string[]
  // Nunca contém Platform.TWITTER — o XPublisher não publica nenhuma imagem hoje
  // (_local-adr-policy-041), então X fica fora do seletor de redes da campanha.
  platforms: Platform[]
  postsPerDay: number
  // Tamanho de carrossel sugerido pelo agrupamento por localidade — padrão "sticky" da
  // campanha inteira (o usuário define uma vez, ex: 5, e todo agrupamento por GPS usa esse
  // valor), editável por item na tela de revisão antes de ativar.
  carouselSizeDefault: number
  status: PhotoCampaignStatus
  createdAt: Date
  updatedAt: Date
  startedAt: Date | null
  completedAt: Date | null
  // Quando as fotos ainda não usadas em nenhum post real (CampaignItem 'planned' no momento
  // do cancelamento) foram apagadas do Cloud Storage pela limpeza automática — 7 dias após
  // updatedAt da transição pra 'cancelled' (_local-edr-policy-067). Preenchido só quando
  // status === 'cancelled'; nunca mexe em fotos cujo CampaignItem ficou 'materialized'
  // (o Post real que as referencia segue seu próprio prazo via imagesDeletedAt).
  photosDeletedAt: Date | null
}
