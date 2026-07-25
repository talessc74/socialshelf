import { randomUUID } from 'crypto'
import { Platform } from '@socialshelf/domain'
import type { PhotoCampaign, PhotoCampaignRepository } from '@socialshelf/domain'

export interface CreatePhotoCampaignInput {
  userId: string
  brandId: string
  name: string
  description: string
  keywords: string[]
  platforms: Platform[]
  postsPerDay: number
  carouselSizeDefault: number
}

export class CreatePhotoCampaignUseCase {
  constructor(private readonly campaignRepo: PhotoCampaignRepository) {}

  async execute(input: CreatePhotoCampaignInput): Promise<PhotoCampaign> {
    if (input.platforms.length === 0) {
      throw new Error('At least one platform must be selected')
    }
    // XPublisher não publica nenhuma imagem hoje (_local-adr-policy-041) — uma campanha de
    // fotos com X selecionado publicaria só texto, quebrando a premissa da campanha.
    if (input.platforms.includes(Platform.TWITTER)) {
      throw new Error('X does not support image posting and cannot be part of a photo campaign')
    }

    const now = new Date()
    const campaign: PhotoCampaign = {
      id: randomUUID(),
      userId: input.userId,
      brandId: input.brandId,
      name: input.name,
      description: input.description,
      keywords: input.keywords,
      platforms: input.platforms,
      postsPerDay: input.postsPerDay,
      carouselSizeDefault: input.carouselSizeDefault,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
      startedAt: null,
      completedAt: null,
      photosDeletedAt: null,
    }

    await this.campaignRepo.save(campaign)
    return campaign
  }
}
