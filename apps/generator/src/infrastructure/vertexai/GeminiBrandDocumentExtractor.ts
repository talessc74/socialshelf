import { z } from 'zod'
import type { BrandDocumentExtractorPort, BrandProfileExtraction } from '@socialshelf/domain'
import { createGeminiClient } from './geminiClient.js'

const extractionSchema = z.object({
  business: z
    .object({
      name: z.string().optional(),
      segment: z.string().optional(),
      description: z.string().optional(),
    })
    .optional(),
  identity: z
    .object({
      positioning: z.string().optional(),
      values: z.array(z.string()).optional(),
    })
    .optional(),
  voice: z
    .object({
      tone: z.string().optional(),
      allowedVocabulary: z.array(z.string()).optional(),
      prohibitedVocabulary: z.array(z.string()).optional(),
    })
    .optional(),
  narrative: z
    .object({
      recurringThemes: z.array(z.string()).optional(),
    })
    .optional(),
})

export class GeminiBrandDocumentExtractor implements BrandDocumentExtractorPort {
  constructor(
    private readonly projectId: string,
    private readonly location: string,
    private readonly model: string,
  ) {}

  async extractFromDocument(base64: string, mimeType: string): Promise<BrandProfileExtraction> {
    const ai = createGeminiClient(this.projectId, this.location)

    const result = await ai.models.generateContent({
      model: this.model,
      contents: [
        {
          role: 'user',
          parts: [{ text: this.buildPrompt() }, { inlineData: { mimeType, data: base64 } }],
        },
      ],
      config: { thinkingConfig: { thinkingBudget: 0 } },
    })
    const text = result.text
    if (!text) throw new Error('Gemini returned no content for brand document extraction')

    const jsonText = text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '')

    let parsedJson: unknown
    try {
      parsedJson = JSON.parse(jsonText)
    } catch {
      throw new Error('Gemini returned invalid JSON for brand document extraction')
    }

    const parsed = extractionSchema.safeParse(parsedJson)
    if (!parsed.success) {
      throw new Error(`Gemini returned an extraction that doesn't match the expected shape: ${parsed.error.message}`)
    }

    return parsed.data
  }

  private buildPrompt(): string {
    return `Você é um analista de branding. Leia o documento anexado (pode ser um briefing, manual de marca, descrição de produto, etc.) e extraia SOMENTE as informações que estiverem claramente presentes nele, no seguinte formato JSON. Não invente nem infira informação que não está explícita no documento — omita qualquer campo ou subcampo que não conseguir identificar com confiança. Responda APENAS com um JSON válido (sem markdown, sem texto fora do JSON) no seguinte formato:

{
  "business": { "name": "...", "segment": "...", "description": "..." },
  "identity": { "positioning": "...", "values": ["...", "..."] },
  "voice": { "tone": "...", "allowedVocabulary": ["...", "..."], "prohibitedVocabulary": ["...", "..."] },
  "narrative": { "recurringThemes": ["...", "..."] }
}

Omita as chaves (ou subchaves) cujo valor não estiver claramente presente no documento. Não inclua nenhum texto antes ou depois do JSON.`
  }
}
