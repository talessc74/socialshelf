import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Platform } from '@socialshelf/domain'
import type { SelfieChatTurn, SelfieAccountStatus, AiUsageRecorderPort } from '@socialshelf/domain'

const generateContent = vi.fn()

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => ({
    models: { generateContent },
  })),
}))

import { GeminiSelfieAssistant } from './GeminiSelfieAssistant.js'

function respondWith(text: string) {
  generateContent.mockResolvedValueOnce({ text })
}

function makeUsageRecorder(): AiUsageRecorderPort {
  return { record: vi.fn().mockResolvedValue(undefined) }
}

function makeAssistant(usageRecorder: AiUsageRecorderPort = makeUsageRecorder()) {
  return new GeminiSelfieAssistant('p', 'global', 'gemini-2.5-flash', usageRecorder)
}

describe('GeminiSelfieAssistant', () => {
  beforeEach(() => {
    generateContent.mockReset()
  })

  it('returns the trimmed text from the model response', async () => {
    respondWith('  Para conectar o Instagram, vá em Central de Contas.  ')

    const answer = await makeAssistant().answer(
      'Como conecto o Instagram?',
      [],
      [],
      'user-1',
      'brand-1',
    )

    expect(answer).toBe('Para conectar o Instagram, vá em Central de Contas.')
  })

  it('includes the connected-account status in the prompt', async () => {
    respondWith('ok')
    const accountStatus: SelfieAccountStatus[] = [
      { platform: Platform.INSTAGRAM, connected: true, accountLabel: '@minhamarca', connectionLikelyExpired: true },
      { platform: Platform.FACEBOOK, connected: false, accountLabel: null, connectionLikelyExpired: false },
    ]

    await makeAssistant().answer('Por que minhas métricas não aparecem?', [], accountStatus, 'user-1', 'brand-1')

    const prompt = (generateContent.mock.calls[0]![0] as { contents: string }).contents
    expect(prompt).toContain('Instagram: conectada (@minhamarca)')
    expect(prompt).toContain('sinal de que a conexão pode ter expirado')
    expect(prompt).toContain('Facebook: não conectada')
  })

  it('includes the recent conversation history in the prompt', async () => {
    respondWith('ok')
    const history: SelfieChatTurn[] = [
      { role: 'user', text: 'Oi' },
      { role: 'selfie', text: 'Olá! Como posso ajudar?' },
    ]

    await makeAssistant().answer('E o LinkedIn?', history, [], 'user-1', 'brand-1')

    const prompt = (generateContent.mock.calls[0]![0] as { contents: string }).contents
    expect(prompt).toContain('Usuário: Oi')
    expect(prompt).toContain('Selfie: Olá! Como posso ajudar?')
  })

  it('instructs the model to decline questions unrelated to the product', async () => {
    respondWith('ok')

    await makeAssistant().answer('Qual a capital da França?', [], [], 'user-1', 'brand-1')

    const prompt = (generateContent.mock.calls[0]![0] as { contents: string }).contents
    expect(prompt).toContain('recuse educadamente')
  })

  it('records AI usage with the selfie-chat operation and the caller userId/brandId', async () => {
    respondWith('ok')
    const usageRecorder = makeUsageRecorder()

    await makeAssistant(usageRecorder).answer('Como conecto o TikTok?', [], [], 'user-1', 'brand-1')

    expect(usageRecorder.record).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        brandId: 'brand-1',
        category: 'text-generation',
        operation: 'selfie-chat',
        model: 'gemini-2.5-flash',
      }),
    )
  })

  it('throws when the model returns no content', async () => {
    respondWith('')

    await expect(
      makeAssistant().answer('Como conecto o Instagram?', [], [], 'user-1', 'brand-1'),
    ).rejects.toThrow('Gemini returned no content for selfie chat')
  })
})
