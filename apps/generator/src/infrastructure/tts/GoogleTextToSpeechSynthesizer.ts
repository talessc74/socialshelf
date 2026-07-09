import { TextToSpeechClient } from '@google-cloud/text-to-speech'
import type { TextToSpeechPort } from '@socialshelf/domain'

export class GoogleTextToSpeechSynthesizer implements TextToSpeechPort {
  private readonly client = new TextToSpeechClient()

  async synthesize(text: string): Promise<Buffer> {
    const [response] = await this.client.synthesizeSpeech({
      input: { text },
      // Sem escolher uma voz específica pelo nome: o Google seleciona uma voz padrão
      // compatível com languageCode + ssmlGender, evitando depender de um nome exato de
      // voz (ex: "pt-BR-Neural2-A") que pode não existir ou mudar entre regiões/contas.
      voice: { languageCode: 'pt-BR', ssmlGender: 'NEUTRAL' },
      audioConfig: { audioEncoding: 'MP3' },
    })

    if (!response.audioContent) {
      throw new Error('Google Text-to-Speech returned no audio content')
    }

    return Buffer.from(response.audioContent)
  }
}
