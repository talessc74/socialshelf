import { randomUUID } from 'crypto'
import type {
  BrandProfile,
  BrandProfileRepository,
  BrandProfileBusiness,
  BrandProfileIdentity,
  BrandProfileVisual,
  BrandProfileVoice,
  BrandProfileNarrative,
  BrandProfileOperation,
} from '@socialshelf/domain'

export interface CreateBrandProfileVersionInput {
  userId: string
  brandId: string
  business: BrandProfileBusiness
  identity: BrandProfileIdentity
  visual: BrandProfileVisual
  voice: BrandProfileVoice
  narrative: BrandProfileNarrative
  operation: BrandProfileOperation
}

export class CreateBrandProfileVersionUseCase {
  constructor(private readonly brandProfileRepo: BrandProfileRepository) {}

  async execute(input: CreateBrandProfileVersionInput): Promise<BrandProfile> {
    const latest = await this.brandProfileRepo.findLatestByBrand(input.userId, input.brandId)
    const nextVersion = (latest?.version ?? 0) + 1

    const profile: BrandProfile = {
      id: randomUUID(),
      userId: input.userId,
      brandId: input.brandId,
      version: nextVersion,
      business: input.business,
      identity: input.identity,
      visual: input.visual,
      voice: input.voice,
      narrative: input.narrative,
      operation: input.operation,
      createdAt: new Date(),
    }

    await this.brandProfileRepo.save(profile)
    return profile
  }
}
