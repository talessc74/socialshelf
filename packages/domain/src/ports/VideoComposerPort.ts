export interface VideoComposerPort {
  composeSlideshow(input: {
    imageBuffers: Buffer[]
    // _local-adr-policy-037: quando há narração, ela dita a duração total do vídeo — o
    // tempo de cada slide é derivado dividindo a duração da narração pelo número de
    // imagens, em vez de usar silentSlideDurationSeconds.
    narrationAudioBuffer: Buffer | null
    silentSlideDurationSeconds: number
    // Atribuição do evento de observabilidade (Fase 0 de billing, sem custo real — ver
    // FfmpegVideoComposer) — a quem atribuir o evento de volume de composição.
    userId: string
    brandId: string
  }): Promise<{ videoBuffer: Buffer; durationSeconds: number }>
}
