export interface BrandTokens {
  primaryColor: string
  secondaryColor: string
  typography: string
}

export interface ImagePrompt {
  description: string
  style?: string
  brandTokens: BrandTokens | null
  position: number
  totalArtifacts: number
}

export interface GeneratedImage {
  base64: string
  mimeType: string
}

export interface ImageGeneratorPort {
  generateImage(prompt: ImagePrompt): Promise<GeneratedImage>
}
