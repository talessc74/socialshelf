import type { BrandProfileBusiness, BrandProfileVoice } from '../entities/BrandProfile.js'
import type { AccountType } from '../entities/AccountType.js'

export interface CampaignCaptionWriterInput {
  coverImage: { base64: string; mimeType: string }
  campaignName: string
  campaignDescription: string
  keywords: string[]
  brandBusiness: BrandProfileBusiness | null
  brandVoice: BrandProfileVoice | null
  // Governa o registro do texto: 'personal' escreve em primeira pessoa, sem CTA, sem citar o
  // dono em terceira pessoa; 'professional' cita a marca pelo nome e pode usar CTA.
  accountType: AccountType
  // Metadados da foto de capa daquele item (EXIF), pra legenda refletir o momento real —
  // quando a foto foi tirada e se carrega registro de local. Null quando a foto não tem EXIF.
  photoTakenAt: Date | null
  photoHasLocation: boolean
  // Quantas fotos há neste item/carrossel — deixa a legenda reconhecer que é um conjunto, não
  // uma foto só, sem repetir a mesma ideia N vezes.
  photoCount: number
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
