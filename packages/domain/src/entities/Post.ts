import type { Platform } from './Platform.js'

export type PostStatus = 'draft' | 'ai-draft' | 'scheduled' | 'publishing' | 'published' | 'failed'

// 'autonomy-tick': criado pelo tick diário de autonomia (_local-adr-policy-040), sem clique
// humano — cobre tanto o rascunho de semi-automático quanto o post já publicado de automático.
// 'manual': qualquer criação disparada por uma ação do usuário na UI, incluindo o clique em
// "Gerar Conteúdo" (o rascunho é da IA, mas a ação que disparou foi manual).
// 'campaign': materializado por ActivateCampaignUseCase a partir de um CampaignItem de uma
// PhotoCampaign (_local-adr-policy-041) — o usuário trouxe a foto, mas a ativação da linha
// do tempo é que disparou a criação deste Post específico, não um clique por post.
export type PostOrigin = 'manual' | 'autonomy-tick' | 'campaign'

export interface PlatformContent {
  platform: Platform
  text: string
  charCount: number
}

export interface Post {
  id: string
  userId: string
  brandId: string
  brandProfileVersion: number | null
  content: PlatformContent[]
  imageStoragePaths: string[]
  // Vídeo enviado pelo próprio usuário para publicação no TikTok (videoSource:
  // 'user-upload' — ver _local-adr-policy-036). Consentimento é capturado no momento
  // do upload (_local-edr-policy-034) e carregado para o Post no momento da criação.
  videoStoragePath: string | null
  videoConsentAcceptedAt: Date | null
  status: PostStatus
  origin: PostOrigin
  // Id da PhotoCampaign que materializou este Post, quando origin === 'campaign'. Null pra
  // todo o resto — não vale a pena modelar como union discriminada porque isso obrigaria
  // um refinamento de tipo em todo write-site de Post só pra um campo opcional.
  campaignId: string | null
  scheduledAt: Date | null
  publishedAt: Date | null
  externalIds: Partial<Record<Platform, string>>
  // URL do artigo de notícia que originou este post, quando criado a partir de uma sugestão de
  // pauta. Usado para marcar, na tela de notícias, que esse artigo já gerou um post publicado.
  sourceArticleUrl: string | null
  createdAt: Date
  updatedAt: Date
}
