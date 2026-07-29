import { describe, it, expect, vi } from 'vitest'
import type { AiUsageReaderPort, BrandRepository, AiUsageEvent, Brand } from '@socialshelf/domain'
import { GetAdminAiUsageSummaryUseCase } from './GetAdminAiUsageSummaryUseCase.js'

function makeBrand(overrides: Partial<Brand> = {}): Brand {
  return {
    id: 'brand-1',
    userId: 'user-1',
    name: 'Eai Jurídico',
    slug: 'eai-juridico',
    platforms: [],
    accountType: 'professional',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

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
    estimatedCostUsd: 0.001,
    createdAt: new Date('2026-07-15T12:00:00Z'),
    ...overrides,
  }
}

function makeDeps(brands: Brand[], events: AiUsageEvent[]) {
  const aiUsageReader: AiUsageReaderPort = { findAll: vi.fn().mockResolvedValue(events), findByBrand: vi.fn() }
  const brandRepo: BrandRepository = {
    save: vi.fn(),
    findById: vi.fn(),
    findByUserId: vi.fn(),
    delete: vi.fn(),
    findAll: vi.fn().mockResolvedValue(brands),
  }
  return { aiUsageReader, brandRepo }
}

describe('GetAdminAiUsageSummaryUseCase', () => {
  it('separa custo de texto e de imagem por mês, para cada marca', async () => {
    const deps = makeDeps(
      [makeBrand()],
      [
        makeEvent({ category: 'text-generation', estimatedCostUsd: 0.002 }),
        makeEvent({ category: 'image-generation', estimatedCostUsd: 0.04, id: 'event-2' }),
      ],
    )
    const useCase = new GetAdminAiUsageSummaryUseCase(deps.aiUsageReader, deps.brandRepo)

    const result = await useCase.execute()

    expect(result.brands).toEqual([
      {
        brandId: 'brand-1',
        brandName: 'Eai Jurídico',
        months: [{ month: '2026-07', textUsd: 0.002, imageUsd: 0.04, totalUsd: 0.042 }],
      },
    ])
  })

  it('agrupa por mês separadamente quando há eventos em meses diferentes', async () => {
    const deps = makeDeps(
      [makeBrand()],
      [
        makeEvent({ createdAt: new Date('2026-06-10T00:00:00Z'), estimatedCostUsd: 0.01 }),
        makeEvent({ createdAt: new Date('2026-07-10T00:00:00Z'), estimatedCostUsd: 0.02, id: 'event-2' }),
      ],
    )
    const useCase = new GetAdminAiUsageSummaryUseCase(deps.aiUsageReader, deps.brandRepo)

    const result = await useCase.execute()

    expect(result.brands[0]?.months.map((m) => m.month)).toEqual(['2026-07', '2026-06'])
  })

  it('inclui marcas sem nenhum evento com months vazio', async () => {
    const deps = makeDeps([makeBrand({ id: 'brand-2', name: 'Conta pessoal' })], [])
    const useCase = new GetAdminAiUsageSummaryUseCase(deps.aiUsageReader, deps.brandRepo)

    const result = await useCase.execute()

    expect(result.brands).toEqual([{ brandId: 'brand-2', brandName: 'Conta pessoal', months: [] }])
  })

  it('ordena as marcas por nome', async () => {
    const deps = makeDeps(
      [makeBrand({ id: 'brand-2', name: 'Zebra Corp' }), makeBrand({ id: 'brand-1', name: 'Acme' })],
      [],
    )
    const useCase = new GetAdminAiUsageSummaryUseCase(deps.aiUsageReader, deps.brandRepo)

    const result = await useCase.execute()

    expect(result.brands.map((b) => b.brandName)).toEqual(['Acme', 'Zebra Corp'])
  })
})
