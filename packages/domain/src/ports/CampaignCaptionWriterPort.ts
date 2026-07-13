import type { BrandProfileBusiness, BrandProfileVoice } from '../entities/BrandProfile.js'

export interface CampaignCaptionWriterInput {
  coverImage: { base64: string; mimeType: string }
  campaignName: string
  campaignDescription: string
  keywords: string[]
  brandBusiness: BrandProfileBusiness | null
  brandVoice: BrandProfileVoice | null
}

export interface CampaignCaptionWriterResult {
  caption: string
}

// Escreve a legenda de um item de campanha (post/carrossel) olhando de fato a foto de capa
// daquele item — não só o contexto textual da campanha. Um writer por item, não um por
// campanha inteira: cada foto pede uma legenda própria, mesmo dentro da mesma campanha.
export interface CampaignCaptionWriterPort {
  write(input: CampaignCaptionWriterInput): Promise<CampaignCaptionWriterResult>
}
