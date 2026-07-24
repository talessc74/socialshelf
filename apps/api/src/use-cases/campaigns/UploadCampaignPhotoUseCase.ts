import { randomUUID } from 'crypto'
import type { CampaignPhoto, CampaignPhotoRepository, PhotoCampaignRepository } from '@socialshelf/domain'
import { extractPhotoMetadata } from '../../infrastructure/exif/extractPhotoMetadata.js'
import { fetchInternal } from '../../lib/serviceAuth.js'

export interface UploadCampaignPhotoInput {
  userId: string
  brandId: string
  campaignId: string
  buffer: Buffer
  mimeType: string
}

export class UploadCampaignPhotoUseCase {
  constructor(
    private readonly campaignRepo: PhotoCampaignRepository,
    private readonly photoRepo: CampaignPhotoRepository,
    private readonly generatorUrl: string,
    private readonly internalSecret: string,
  ) {}

  async execute(input: UploadCampaignPhotoInput): Promise<CampaignPhoto> {
    const campaign = await this.campaignRepo.findByIdAndBrand(input.campaignId, input.userId, input.brandId)
    if (!campaign) throw new Error('Campaign not found')

    // Próxima posição da sequência manual (ver CampaignPhoto.order) — contagem em vez de
    // buscar todas as fotos, pra não virar O(n²) num lote grande de upload.
    const order = await this.photoRepo.countByCampaign(input.userId, input.brandId, input.campaignId)
    const metadata = await extractPhotoMetadata(input.buffer)

    // Reaproveita o mesmo endpoint interno de storage já usado pelo upload manual de imagens
    // (apps/generator /images/upload, ver generation.routes.ts) — zero código novo de storage.
    const res = await fetchInternal(`${this.generatorUrl}/images/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Internal-Secret': this.internalSecret },
      body: JSON.stringify({
        userId: input.userId,
        brandId: input.brandId,
        base64: input.buffer.toString('base64'),
        mimeType: input.mimeType,
        // Foto de campanha pede o hash perceptual pra detecção de quase-iguais no carrossel.
        perceptualHash: true,
      }),
    })

    if (!res.ok) {
      throw new Error(`Failed to store campaign photo: ${res.status}`)
    }
    const { path, perceptualHash, aspectRatio } = (await res.json()) as {
      path: string
      perceptualHash?: string | null
      aspectRatio?: number | null
    }

    const photo: CampaignPhoto = {
      id: randomUUID(),
      userId: input.userId,
      brandId: input.brandId,
      campaignId: input.campaignId,
      storagePath: path,
      exifTakenAt: metadata.exifTakenAt,
      gpsLat: metadata.gpsLat,
      gpsLng: metadata.gpsLng,
      locationClusterId: null,
      createdAt: new Date(),
      order,
      perceptualHash: perceptualHash ?? null,
      duplicateOfPhotoId: null,
      aspectRatio: aspectRatio ?? null,
      unsupportedAspectRatio: false,
    }

    await this.photoRepo.save(photo)
    return photo
  }
}
