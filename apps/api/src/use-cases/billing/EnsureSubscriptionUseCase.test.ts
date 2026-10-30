import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EnsureSubscriptionUseCase, BILLING_CUTOVER_DATE } from './EnsureSubscriptionUseCase.js'
import type { Subscription, SubscriptionRepository, BrandRepository, Brand } from '@socialshelf/domain'

function makeBrand(overrides: Partial<Brand> = {}): Brand {
  return {
    id: 'brand-1',
    userId: 'user-1',
    name: 'Minha Marca',
    slug: 'minha-marca',
    platforms: [],
    accountType: 'professional',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  }
}

describe('EnsureSubscriptionUseCase', () => {
  let useCase: EnsureSubscriptionUseCase
  let mockSubscriptionRepo: SubscriptionRepository
  let mockBrandRepo: BrandRepository

  beforeEach(() => {
    mockSubscriptionRepo = {
      findByUserId: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockResolvedValue(undefined),
    }
    mockBrandRepo = {
      save: vi.fn(),
      findById: vi.fn(),
      findByUserId: vi.fn().mockResolvedValue([]),
      delete: vi.fn(),
      findAll: vi.fn(),
    }
    useCase = new EnsureSubscriptionUseCase(mockSubscriptionRepo, mockBrandRepo)
  })

  it('devolve o Subscription existente sem criar outro nem consultar marcas', async () => {
    const existing: Subscription = {
      userId: 'user-1',
      tier: 'pro',
      billingCycle: 'monthly',
      status: 'active',
      stripeCustomerId: 'cus_123',
      stripeSubscriptionId: 'sub_123',
      additionalProfessionalBrands: 0,
      adminOverrideUnlimited: false,
      trialEndsAt: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    mockSubscriptionRepo.findByUserId = vi.fn().mockResolvedValue(existing)

    const result = await useCase.execute('user-1', 'user@example.com')

    expect(result).toEqual(existing)
    expect(mockBrandRepo.findByUserId).not.toHaveBeenCalled()
    expect(mockSubscriptionRepo.save).not.toHaveBeenCalled()
  })

  it('cria um Subscription legado para usuário com marca anterior ao corte de billing', async () => {
    const beforeCutover = new Date(BILLING_CUTOVER_DATE.getTime() - 1000 * 60 * 60 * 24)
    mockBrandRepo.findByUserId = vi.fn().mockResolvedValue([makeBrand({ createdAt: beforeCutover })])

    const result = await useCase.execute('user-1', 'user@example.com')

    expect(result.tier).toBe('legacy')
    expect(mockSubscriptionRepo.save).toHaveBeenCalledWith(expect.objectContaining({ tier: 'legacy', userId: 'user-1' }))
  })

  it('cria um Subscription grátis para usuário sem nenhuma marca', async () => {
    mockBrandRepo.findByUserId = vi.fn().mockResolvedValue([])

    const result = await useCase.execute('user-1', 'user@example.com')

    expect(result.tier).toBe('free')
  })

  it('cria um Subscription grátis para usuário cuja marca mais antiga é posterior ao corte', async () => {
    const afterCutover = new Date(BILLING_CUTOVER_DATE.getTime() + 1000 * 60 * 60 * 24)
    mockBrandRepo.findByUserId = vi.fn().mockResolvedValue([makeBrand({ createdAt: afterCutover })])

    const result = await useCase.execute('user-1', 'user@example.com')

    expect(result.tier).toBe('free')
  })

  it('marca adminOverrideUnlimited para o e-mail da allowlist de admin', async () => {
    const result = await useCase.execute('user-1', 'talessc@me.com')

    expect(result.adminOverrideUnlimited).toBe(true)
  })

  it('não marca adminOverrideUnlimited para um e-mail comum', async () => {
    const result = await useCase.execute('user-1', 'user@example.com')

    expect(result.adminOverrideUnlimited).toBe(false)
  })
})
