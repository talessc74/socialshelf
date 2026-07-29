import { describe, it, expect, vi } from 'vitest'
import type { AiUsageRecorderPort } from '@socialshelf/domain'
import { recordGeminiUsage } from './geminiClient.js'

function makeRecorder() {
  return { record: vi.fn().mockResolvedValue(undefined) } as unknown as AiUsageRecorderPort & { record: ReturnType<typeof vi.fn> }
}

describe('recordGeminiUsage', () => {
  it('estima o custo a partir dos tokens reais devolvidos pela API e registra o evento', () => {
    const recorder = makeRecorder()

    recordGeminiUsage(
      recorder,
      { userId: 'user-1', brandId: 'brand-1', operation: 'copy-generation', model: 'gemini-2.5-flash' },
      { promptTokenCount: 1_000_000, candidatesTokenCount: 1_000_000, thoughtsTokenCount: 0 },
    )

    expect(recorder.record).toHaveBeenCalledWith({
      userId: 'user-1',
      brandId: 'brand-1',
      category: 'text-generation',
      operation: 'copy-generation',
      model: 'gemini-2.5-flash',
      promptTokenCount: 1_000_000,
      candidatesTokenCount: 1_000_000,
      thoughtsTokenCount: 0,
      estimatedCostUsd: 0.3 + 2.5,
    })
  })

  it('soma thoughtsTokenCount ao custo de saída, mesmo que fique 0 com thinking desligado', () => {
    const recorder = makeRecorder()

    recordGeminiUsage(
      recorder,
      { userId: 'user-1', brandId: 'brand-1', operation: 'art-direction', model: 'gemini-2.5-flash' },
      { promptTokenCount: 0, candidatesTokenCount: 0, thoughtsTokenCount: 500_000 },
    )

    expect(recorder.record).toHaveBeenCalledWith(
      expect.objectContaining({ estimatedCostUsd: 1.25 }),
    )
  })

  it('trata usageMetadata ausente como zero, sem lançar', () => {
    const recorder = makeRecorder()

    recordGeminiUsage(
      recorder,
      { userId: 'user-1', brandId: 'brand-1', operation: 'translation', model: 'gemini-2.5-flash' },
      undefined,
    )

    expect(recorder.record).toHaveBeenCalledWith(
      expect.objectContaining({
        estimatedCostUsd: 0,
        promptTokenCount: undefined,
        candidatesTokenCount: undefined,
        thoughtsTokenCount: undefined,
      }),
    )
  })
})
