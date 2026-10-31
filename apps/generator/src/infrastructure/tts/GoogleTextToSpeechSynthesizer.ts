import { TextToSpeechClient } from '@google-cloud/text-to-speech'
import { estimateTtsCostUsd } from '@socialshelf/domain'
import type { TextToSpeechPort, AiUsageRecorderPort } from '@socialshelf/domain'

// Nome do modelo registrado no evento de uso (Fase 0 de billing) — não um model id de API, só
// um rótulo estável pra diferenciar esta fonte de custo das chamadas Gemini na tela de gastos.
// "standard" porque nenhuma voz é pedida pelo nome (ver comentário abaixo) — se isso mudar para
// uma voz WaveNet/Neural2, este rótulo (e GOOGLE_TTS_USD_PER_MILLION_CHARS) precisa acompanhar.
const TTS_MODEL_LABEL = 'google-tts-standard'

export class GoogleTextToSpeechSynthesizer implements TextToSpeechPort {
  private readonly client = new TextToSpeechClient()

  constructor(private readonly usageRecorder: AiUsageRecorderPort) {}

  async synthesize({ text, userId, brandId }: { text: string; userId: string; brandId: string }): Promise<Buffer> {
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

    void this.usageRecorder.record({
      userId,
      brandId,
      category: 'audio-synthesis',
      operation: 'tts-narration',
      model: TTS_MODEL_LABEL,
      estimatedCostUsd: estimateTtsCostUsd(text.length),
    })

    return Buffer.from(response.audioContent)
  }
}
