export interface VideoComposerPort {
  composeSlideshow(input: {
    slides: { imageBuffer: Buffer; durationSeconds: number }[]
  }): Promise<{ videoBuffer: Buffer; durationSeconds: number }>
}
