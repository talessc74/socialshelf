export interface BrandProfileExtraction {
  business?:
    | {
        name?: string | undefined
        segment?: string | undefined
        description?: string | undefined
      }
    | undefined
  identity?:
    | {
        positioning?: string | undefined
        values?: string[] | undefined
      }
    | undefined
  voice?:
    | {
        tone?: string | undefined
        allowedVocabulary?: string[] | undefined
        prohibitedVocabulary?: string[] | undefined
      }
    | undefined
  narrative?:
    | {
        recurringThemes?: string[] | undefined
      }
    | undefined
}

export interface BrandDocumentExtractorPort {
  // userId/brandId: atribuição de custo de IA (Fase 0 de billing) — quem pagou por esta chamada.
  extractFromDocument(base64: string, mimeType: string, userId: string, brandId: string): Promise<BrandProfileExtraction>
}
