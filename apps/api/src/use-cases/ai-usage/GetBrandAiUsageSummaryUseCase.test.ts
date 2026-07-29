import { describe, it, expect, vi } from 'vitest'
import type { AiUsageReaderPort, AiUsageEvent } from '@socialshelf/domain'
import { GetBrandAiUsageSummaryUseCase } from './GetBrandAiUsageSummaryUseCase.js'

function makeEvent(overrides: Partial<AiUsageEvent> = {}): AiUsageEvent {
  return {
    id: 'event-1',
    userId: 'user-1',
    brandId: 'brand-1',
    category: 'text-generation',
    operation: 'copy-generation',
    model: 'gemini-2.5-flash',
    promptTokenCount: 1000,
    candidatesTokenCount: 500,
    thoughtsTokenCount: 0,
    imageCount: null,
    estimatedCostUsd: 0.002,
    createdAt: new Date('2026-07-15T12:00:00Z'),
    ...overrides,
  }
}

describe('GetBrandAiUsageSummaryUseCase', () => {
  it('busca só os eventos da marca informada e agrupa por mês', async () => {
    const aiUsageReader: AiUsageReaderPort = {
      findAll: vi.fn(),
      findByBrand: vi.fn().mockResolvedValue([
        makeEvent({ category: 'text-generation', estimatedCostUsd: 0.002 }),
        makeEvent({ category: 'image-generation', estimatedCostUsd: 0.04, id: 'event-2' }),
      ]),
    }
    const useCase = new GetBrandAiUsageSummaryUseCase(aiUsageReader)

    const result = await useCase.execute('user-1', 'brand-1')

    expect(aiUsageReader.findByBrand).toHaveBeenCalledWith('user-1', 'brand-1')
    expect(result.months).toEqual([{ month: '2026-07', textUsd: 0.002, imageUsd: 0.04, totalUsd: 0.042 }])
  })

  it('retorna months vazio quando a marca não tem nenhum evento', async () => {
    const aiUsageReader: AiUsageReaderPort = { findAll: vi.fn(), findByBrand: vi.fn().mockResolvedValue([]) }
    const useCase = new GetBrandAiUsageSummaryUseCase(aiUsageReader)

    const result = await useCase.execute('user-1', 'brand-1')

    expect(result.months).toEqual([])
  })
})
