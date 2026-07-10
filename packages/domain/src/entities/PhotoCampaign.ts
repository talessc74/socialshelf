import type { Platform } from './Platform.js'

export type PhotoCampaignStatus = 'draft' | 'reviewing' | 'active' | 'completed' | 'cancelled'

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
}
