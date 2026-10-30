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

    const result = await useCase.execute('user-1', 'brand-1', null)

    expect(aiUsageReader.findByBrand).toHaveBeenCalledWith('user-1', 'brand-1')
    expect(result.months).toEqual([
      { month: '2026-07', textUsd: 0.002, imageUsd: 0.04, audioUsd: 0, videoUsd: 0, totalUsd: 0.042 },
    ])
  })

  it('retorna months vazio quando a marca não tem nenhum evento', async () => {
    const aiUsageReader: AiUsageReaderPort = { findAll: vi.fn(), findByBrand: vi.fn().mockResolvedValue([]) }
    const useCase = new GetBrandAiUsageSummaryUseCase(aiUsageReader)

    const result = await useCase.execute('user-1', 'brand-1', null)

    expect(result.months).toEqual([])
  })

  it('filtra eventos mais antigos que o teto de retenção do plano', async () => {
    const aiUsageReader: AiUsageReaderPort = {
      findAll: vi.fn(),
      findByBrand: vi.fn().mockResolvedValue([
        makeEvent({ id: 'old', createdAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000), estimatedCostUsd: 0.5 }),
        makeEvent({ id: 'recent', createdAt: new Date(), estimatedCostUsd: 0.1 }),
      ]),
    }
    const useCase = new GetBrandAiUsageSummaryUseCase(aiUsageReader)

    const result = await useCase.execute('user-1', 'brand-1', 30)

    const totalUsd = result.months.reduce((sum, m) => sum + m.totalUsd, 0)
    expect(totalUsd).toBeCloseTo(0.1)
  })
})
