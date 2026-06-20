import { GoogleAuth } from 'google-auth-library'
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
        parameters: { sampleCount: 1, aspectRatio: prompt.aspectRatio },
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
    const brandSection = prompt.brandTokens
      ? ` Usar paleta de cores ${prompt.brandTokens.primaryColor} e ${prompt.brandTokens.secondaryColor}, com estilo tipográfico ${prompt.brandTokens.typography}.`
      : ''
    const seriesSection =
      prompt.totalArtifacts > 1
        ? ` Esta é a imagem ${prompt.position} de ${prompt.totalArtifacts} de um carrossel — manter coerência visual com as demais.`
        : ''

    return `${prompt.description}${styleSection}${brandSection}${seriesSection}`
  }
}
