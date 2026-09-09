import { ApiError, type GoogleGenAI } from '@google/genai'
import { TemplateStyle, estimateGeminiImageCostUsd } from '@socialshelf/domain'
import type { ImageGeneratorPort, ImagePrompt, GeneratedImage, AiUsageRecorderPort } from '@socialshelf/domain'
import { createGeminiClient } from './geminiClient.js'

// As 5 variações de artifact de um post disparam generateImage em paralelo (Promise.all em
// GenerateContentUseCase), o que esbarra na cota de requisições-por-minuto do projeto para este
// modelo — observado em produção como 429 RESOURCE_EXHAUSTED mesmo com prompts válidos
// (_local-edr-policy-078). Só esse status é retentado; qualquer outro erro (prompt rejeitado,
// permissão, etc.) continua lançando de imediato, no mesmo padrão de MetaPublisher.publishInstagram.
const RATE_LIMIT_RETRY_MAX_ATTEMPTS = 3
const RATE_LIMIT_RETRY_DELAY_MS = 5000

// A família "Imagen" standalone (endpoint REST :predict) foi descontinuada pelo Google e
// removida do Model Garden — geração de imagem migrou para dentro dos próprios modelos Gemini
// multimodais ("Nano Banana"), chamados pelo mesmo generateContent que as classes de texto já
// usam (_local-edr-policy-077). Substitui a antiga ImagenImageGenerator.
export class GeminiImageGenerator implements ImageGeneratorPort {
  constructor(
    private readonly projectId: string,
    private readonly location: string,
    private readonly model: string,
    private readonly usageRecorder: AiUsageRecorderPort,
  ) {}

  async generateImage(prompt: ImagePrompt): Promise<GeneratedImage> {
    const ai = createGeminiClient(this.projectId, this.location)

    const result = await this.generateContentWithRateLimitRetry(ai, prompt)

    const parts = result.candidates?.[0]?.content?.parts ?? []
    const imagePart = parts.find((part) => part.inlineData?.data)
    if (!imagePart?.inlineData?.data) {
      throw new Error('Gemini returned no image data for image generation')
    }

    void this.usageRecorder.record({
      userId: prompt.userId,
      brandId: prompt.brandId,
      category: 'image-generation',
      operation: 'imagen-generation',
      model: this.model,
      imageCount: 1,
      estimatedCostUsd: estimateGeminiImageCostUsd(1),
    })

    return {
      base64: imagePart.inlineData.data,
      mimeType: imagePart.inlineData.mimeType ?? 'image/png',
    }
  }

  private async generateContentWithRateLimitRetry(ai: GoogleGenAI, prompt: ImagePrompt) {
    for (let attempt = 0; attempt < RATE_LIMIT_RETRY_MAX_ATTEMPTS; attempt++) {
      try {
        return await ai.models.generateContent({
          model: this.model,
          contents: this.buildPrompt(prompt),
          config: {
            responseModalities: ['Image'],
            imageConfig: { aspectRatio: prompt.aspectRatio },
          },
        })
      } catch (err) {
        const isRateLimited = err instanceof ApiError && err.status === 429
        const isLastAttempt = attempt === RATE_LIMIT_RETRY_MAX_ATTEMPTS - 1
        if (!isRateLimited || isLastAttempt) {
          throw err
        }
        await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_RETRY_DELAY_MS))
      }
    }

    // Inalcançável (o loop sempre retorna ou lança na última tentativa) — só satisfaz o
    // TypeScript quanto ao tipo de retorno da função.
    throw new Error('Gemini image generation failed: exhausted rate-limit retries')
  }

  private buildPrompt(prompt: ImagePrompt): string {
    const styleSection = prompt.style ? ` Estilo: ${prompt.style}.` : ''
    // As cores reais da marca são aplicadas depois por SharpTemplateRenderer (fills de SVG).
    // Nunca mencionar os códigos hex em si: o modelo tende a renderizá-los como texto literal
    // na imagem (ex.: "#22E5E5" aparecendo escrito sobre a foto).
    const brandSection = prompt.brandTokens ? ` Estilo tipográfico de referência: ${prompt.brandTokens.typography}.` : ''
    const seriesSection =
      prompt.totalArtifacts > 1
        ? ` Esta é a imagem ${prompt.position} de ${prompt.totalArtifacts} de um carrossel — manter coerência visual com as demais.`
        : ''
    // O headline (quando existir) é desenhado depois por SharpTemplateRenderer, nunca pelo
    // modelo de imagem: modelos de imagem não renderizam texto em português de forma confiável
    // (acentos, legibilidade) — instruir o modelo a "escrever" produz texto ilegível ou alucinado.
    const noTextSection = ' Não incluir nenhum texto, palavra, letra, número ou tipografia na imagem — apenas elementos visuais (fotografia ou ilustração), sem nenhum tipo de escrita.'
    // Âncora de densidade/qualidade: por política de produto (BDR-006) a direção visual é densa
    // e calorosa, nunca minimalista. Sem isto o modelo tende ao lugar-comum de um sujeito isolado
    // sobre fundo liso — exatamente o que deixava os cards sem graça.
    const richnessSection =
      ' A imagem deve ser rica e envolvente: composição em camadas com profundidade (primeiro plano, plano médio e fundo), contexto ambiental concreto com objetos de apoio relevantes, luz natural e calorosa, materiais e texturas reais, qualidade de fotografia editorial — nunca um sujeito isolado sobre fundo vazio, liso ou neutro.'
    const textZoneSection = prompt.hasTextOverlay ? this.textZoneInstruction(prompt.templateStyle, prompt.hasBodyOverlay ?? false) : ''
    // A API de imagem do Gemini não tem um parâmetro de negativePrompt dedicado (diferente do
    // antigo endpoint :predict do Imagen) — o que evitar entra como instrução de texto no
    // próprio prompt, igual ao restante das instruções negativas acima (noTextSection).
    const avoidSection = [
      'text, words, letters, numbers, typography, writing, captions, watermark, signage, lorem ipsum, placeholder text, gibberish text, fake subtitles, advertisement copy, hex color codes, color codes, font name labels, diagram labels, comparison labels, infographic captions',
      ...(prompt.negativePrompt ? [prompt.negativePrompt] : []),
    ].join(', ')
    const negativeSection = ` Evite: ${avoidSection}.`

    return `${prompt.description}${styleSection}${brandSection}${richnessSection}${seriesSection}${noTextSection}${textZoneSection}${negativeSection}`
  }

  // Uma barra de texto vetorial será sobreposta depois nesta zona, mas a instrução abaixo nunca
  // menciona texto, legenda ou "espaço reservado": dizer ao modelo que uma área é "para texto"
  // o faz associar a cena a uma peça publicitária e preencher essa área com texto fictício
  // ilegível — o próprio bug que estamos evitando. A direção é puramente fotográfica (tom
  // uniforme, baixo contraste, fora de foco) e nunca cita o propósito por trás dela.
  private textZoneInstruction(templateStyle: TemplateStyle, hasBodyOverlay: boolean): string {
    // A zona é apenas mais calma (luz suave, contraste mais baixo, menos pontos focais), nunca
    // vazia: o scrim em gradiente do SharpTemplateRenderer garante a legibilidade do texto, então
    // a foto pode permanecer rica também aqui — só evitamos um detalhe gritante exatamente atrás
    // do texto. Frações menores que antes, para deixar mais da cena rica em foco.
    switch (templateStyle) {
      case TemplateStyle.BOLD_BOTTOM:
        return hasBodyOverlay
          ? ' A faixa inferior (cerca de 30% da altura) deve ter luz mais suave, contraste mais baixo e menos pontos focais, sem ficar vazia.'
          : ' O terço inferior da composição deve ter luz mais suave, contraste mais baixo e menos pontos focais, sem ficar vazio.'
      case TemplateStyle.TOP_STRIP:
        return hasBodyOverlay
          ? ' A faixa superior (cerca de 28% da altura) deve ter luz mais suave, contraste mais baixo e menos pontos focais, sem ficar vazia.'
          : ' A faixa superior da composição deve ter luz mais suave, contraste mais baixo e menos pontos focais, sem ficar vazia.'
      case TemplateStyle.CENTERED_OVERLAY:
        return ' O centro da composição deve ter luz mais suave e contraste mais baixo, com menos pontos focais ali, sem ficar vazio.'
      case TemplateStyle.NO_TEXT:
        // Nunca chega aqui — hasTextOverlay é sempre false para NO_TEXT (decidido pelo use-case).
        return ''
    }
  }
}
