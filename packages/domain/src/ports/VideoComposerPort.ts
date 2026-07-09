export interface VideoComposerPort {
  composeSlideshow(input: {
    imageBuffers: Buffer[]
    // _local-adr-policy-037: quando há narração, ela dita a duração total do vídeo — o
    // tempo de cada slide é derivado dividindo a duração da narração pelo número de
    // imagens, em vez de usar silentSlideDurationSeconds.
    narrationAudioBuffer: Buffer | null
    silentSlideDurationSeconds: number
  }): Promise<{ videoBuffer: Buffer; durationSeconds: number }>
}
