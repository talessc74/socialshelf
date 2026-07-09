export interface TextToSpeechPort {
  synthesize(text: string): Promise<Buffer>
}
