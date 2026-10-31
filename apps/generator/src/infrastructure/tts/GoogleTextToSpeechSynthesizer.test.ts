import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AiUsageRecorderPort } from '@socialshelf/domain'

const synthesizeSpeech = vi.fn()

vi.mock('@google-cloud/text-to-speech', () => ({
  TextToSpeechClient: vi.fn().mockImplementation(() => ({
    synthesizeSpeech,
  })),
}))

import { GoogleTextToSpeechSynthesizer } from './GoogleTextToSpeechSynthesizer.js'

function makeUsageRecorder(): AiUsageRecorderPort {
  return { record: vi.fn().mockResolvedValue(undefined) }
}

describe('GoogleTextToSpeechSynthesizer', () => {
  beforeEach(() => {
    synthesizeSpeech.mockReset()
  })

  it('returns the synthesized audio as a Buffer', async () => {
    synthesizeSpeech.mockResolvedValueOnce([{ audioContent: Buffer.from('fake-mp3-bytes') }])

    const result = await new GoogleTextToSpeechSynthesizer(makeUsageRecorder()).synthesize({
      text: 'Confira essa novidade incrível.',
      userId: 'user-1',
      brandId: 'brand-1',
    })

    expect(result).toBeInstanceOf(Buffer)
    expect(result.toString()).toBe('fake-mp3-bytes')
  })

  it('throws when the API returns no audio content', async () => {
    synthesizeSpeech.mockResolvedValueOnce([{}])

    await expect(
      new GoogleTextToSpeechSynthesizer(makeUsageRecorder()).synthesize({
        text: 'texto',
        userId: 'user-1',
        brandId: 'brand-1',
      }),
    ).rejects.toThrow('Google Text-to-Speech returned no audio content')
  })

  it('records AI usage with the audio-synthesis category and a cost based on character count', async () => {
    synthesizeSpeech.mockResolvedValueOnce([{ audioContent: Buffer.from('fake-mp3-bytes') }])
    const usageRecorder = makeUsageRecorder()
    const text = 'a'.repeat(1_000_000)

    await new GoogleTextToSpeechSynthesizer(usageRecorder).synthesize({ text, userId: 'user-1', brandId: 'brand-1' })

    expect(usageRecorder.record).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        brandId: 'brand-1',
        category: 'audio-synthesis',
        operation: 'tts-narration',
        estimatedCostUsd: 4.0,
      }),
    )
  })

  it('does not record AI usage when synthesis fails', async () => {
    synthesizeSpeech.mockResolvedValueOnce([{}])
    const usageRecorder = makeUsageRecorder()

    await expect(
      new GoogleTextToSpeechSynthesizer(usageRecorder).synthesize({
        text: 'texto',
        userId: 'user-1',
        brandId: 'brand-1',
      }),
    ).rejects.toThrow()

    expect(usageRecorder.record).not.toHaveBeenCalled()
  })
})
