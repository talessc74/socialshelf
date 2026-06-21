import { GoogleAuth } from 'google-auth-library'
import { TemplateStyle } from '@socialshelf/domain'
import type { ImageGeneratorPort, ImagePrompt, GeneratedImage } from '@socialshelf/domain'

export class ImagenImageGenerator implements ImageGeneratorPort {
  constructor(
    private readonly projectId: string,
    private readonly location: string,
    private readonly model: string,
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
          negativePrompt: 'text, words, letters, numbers, typography, writing, captions, watermark, signage',
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
    const textZoneSection = prompt.hasTextOverlay ? this.textZoneInstruction(prompt.templateStyle) : ''

    return `${prompt.description}${styleSection}${brandSection}${seriesSection}${noTextSection}${textZoneSection}`
  }

  // Uma barra de texto vetorial será sobreposta depois nesta zona — pedimos ao Imagen para
  // compor a cena com uma área visualmente "calma" ali (sem elementos de foco), em vez de
  // só proibir texto sem dar nenhuma direção de composição, o que deixava a barra com cara de
  // remendo colado sobre a foto.
  private textZoneInstruction(templateStyle: TemplateStyle): string {
    switch (templateStyle) {
      case TemplateStyle.BOLD_BOTTOM:
        return ' Componha a cena deixando o terço inferior da imagem mais simples e com menos detalhe visual, pois uma barra de texto será sobreposta ali.'
      case TemplateStyle.TOP_STRIP:
        return ' Componha a cena deixando a faixa superior da imagem mais simples e com menos detalhe visual, pois uma barra de texto será sobreposta ali.'
      case TemplateStyle.CENTERED_OVERLAY:
        return ' Componha a cena com o centro da imagem visualmente mais calmo (menos detalhe, contraste suave), pois um texto será sobreposto centralizado ali.'
    }
  }
}
