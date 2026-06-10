export interface ImagePrompt {
  description: string
  style?: string
}

export interface GeneratedImage {
  base64: string
  mimeType: string
}

export interface ImageGeneratorPort {
  generateImage(prompt: ImagePrompt): Promise<GeneratedImage>
}
