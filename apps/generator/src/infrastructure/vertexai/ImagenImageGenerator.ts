import { GoogleAuth } from 'google-auth-library'
import { TemplateStyle, estimateImagenCostUsd } from '@socialshelf/domain'
import type { ImageGeneratorPort, ImagePrompt, GeneratedImage, AiUsageRecorderPort } from '@socialshelf/domain'

export class ImagenImageGenerator implements ImageGeneratorPort {
  constructor(
    private readonly projectId: string,
    private readonly location: string,
    private readonly model: string,
    private readonly usageRecorder: AiUsageRecorderPort,
    private readonly auth: GoogleAuth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    }),
  ) {}

  async generateImage(prompt: ImagePrompt): Promise<GeneratedImage> {
    const accessToken = await this.auth.getAccessToken()
    if (!accessToken) throw new Error('Failed to obtain Google access token for Imagen')

    const endpoint = `https://${this.location}-aiplatform.googleapis.com/v1/projects/${this.projectId}/locations/${this.location}/publishers/google/models/${this.model}:predict`

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        instances: [{ prompt: this.buildPrompt(prompt) }],
        parameters: {
          sampleCount: 1,
          aspectRatio: prompt.aspectRatio,
          // O headline real é desenhado depois por SharpTemplateRenderer; negativePrompt é mais
          // eficaz que instrução em texto livre para suprimir o texto que o Imagen tenta "escrever".
          // Termos de "placeholder"/lorem ipsum são necessários porque o Imagen, ao receber qualquer
          // instrução de composição que reserve uma área da imagem, tende a interpretar isso como
          // "anúncio com espaço para legenda" e preenche essa área com texto fictício ilegível.
          // O negativePrompt criativo do ArtDirectorPort (quando houver) é somado a este, nunca o substitui.
          negativePrompt: [
            'text, words, letters, numbers, typography, writing, captions, watermark, signage, lorem ipsum, placeholder text, gibberish text, fake subtitles, advertisement copy, hex color codes, color codes, font name labels, diagram labels, comparison labels, infographic captions',
            ...(prompt.negativePrompt ? [prompt.negativePrompt] : []),
          ].join(', '),
        },
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Imagen prediction failed: ${res.status} ${body}`)
    }

    const data = (await res.json()) as {
      predictions?: Array<{ bytesBase64Encoded?: string; mimeType?: string }>
    }
    const prediction = data.predictions?.[0]
    if (!prediction?.bytesBase64Encoded) throw new Error('Imagen returned no image data')

    void this.usageRecorder.record({
      userId: prompt.userId,
      brandId: prompt.brandId,
      category: 'image-generation',
      operation: 'imagen-generation',
      model: this.model,
      imageCount: 1,
      estimatedCostUsd: estimateImagenCostUsd(1),
    })

    return {
      base64: prediction.bytesBase64Encoded,
      mimeType: prediction.mimeType ?? 'image/png',
    }
  }

  private buildPrompt(prompt: ImagePrompt): string {
    const styleSection = prompt.style ? ` Estilo: ${prompt.style}.` : ''
    // As cores reais da marca são aplicadas depois por SharpTemplateRenderer (fills de SVG).
    // Nunca mencionar os códigos hex em si: o Imagen tende a renderizá-los como texto literal
    // na imagem (ex.: "#22E5E5" aparecendo escrito sobre a foto).
    const brandSection = prompt.brandTokens ? ` Estilo tipográfico de referência: ${prompt.brandTokens.typography}.` : ''
    const seriesSection =
      prompt.totalArtifacts > 1
        ? ` Esta é a imagem ${prompt.position} de ${prompt.totalArtifacts} de um carrossel — manter coerência visual com as demais.`
        : ''
    // O headline (quando existir) é desenhado depois por SharpTemplateRenderer, nunca pelo
    // Imagen: modelos de imagem não renderizam texto em português de forma confiável (acentos,
    // legibilidade) — instruir o Imagen a "escrever" produz texto ilegível ou alucinado.
    const noTextSection = ' Não incluir nenhum texto, palavra, letra, número ou tipografia na imagem — apenas elementos visuais (fotografia ou ilustração), sem nenhum tipo de escrita.'
    // Âncora de densidade/qualidade: por política de produto (BDR-006) a direção visual é densa
    // e calorosa, nunca minimalista. Sem isto o Imagen tende ao lugar-comum de um sujeito isolado
    // sobre fundo liso — exatamente o que deixava os cards sem graça.
    const richnessSection =
      ' A imagem deve ser rica e envolvente: composição em camadas com profundidade (primeiro plano, plano médio e fundo), contexto ambiental concreto com objetos de apoio relevantes, luz natural e calorosa, materiais e texturas reais, qualidade de fotografia editorial — nunca um sujeito isolado sobre fundo vazio, liso ou neutro.'
    const textZoneSection = prompt.hasTextOverlay ? this.textZoneInstruction(prompt.templateStyle, prompt.hasBodyOverlay ?? false) : ''

    return `${prompt.description}${styleSection}${brandSection}${richnessSection}${seriesSection}${noTextSection}${textZoneSection}`
  }

  // Uma barra de texto vetorial será sobreposta depois nesta zona, mas a instrução abaixo nunca
  // menciona texto, legenda ou "espaço reservado": dizer ao Imagen que uma área é "para texto"
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
