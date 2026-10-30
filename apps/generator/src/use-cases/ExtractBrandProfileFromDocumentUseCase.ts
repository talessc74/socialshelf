import type { BrandDocumentExtractorPort, BrandProfileExtraction } from '@socialshelf/domain'

export class ExtractBrandProfileFromDocumentUseCase {
  constructor(private readonly extractor: BrandDocumentExtractorPort) {}

  async execute(base64: string, mimeType: string, userId: string, brandId: string): Promise<BrandProfileExtraction> {
    return this.extractor.extractFromDocument(base64, mimeType, userId, brandId)
  }
}
