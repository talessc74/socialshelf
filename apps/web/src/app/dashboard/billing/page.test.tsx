import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import BillingPage from './page'
import { api } from '../../../lib/api'
import type { ApiPlanLimits, ApiSubscription, ApiCreditState } from '../../../lib/api'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}))

vi.mock('../../../lib/api', () => ({
  api: {
    createPortalSession: vi.fn(),
  },
}))

const subscriptionMock = vi.hoisted(() => ({
  current: {
    subscription: null as ApiSubscription | null,
    limits: null as ApiPlanLimits | null,
    credits: null as ApiCreditState | null,
    loading: true,
  },
}))
vi.mock('../../../contexts/SubscriptionContext', () => ({ useSubscription: () => subscriptionMock.current }))

const mockedApi = vi.mocked(api, true)

function makeSubscription(overrides: Partial<ApiSubscription> = {}): ApiSubscription {
  return {
    userId: 'user-1',
    tier: 'pro',
    billingCycle: 'monthly',
    status: 'active',
    stripeCustomerId: 'cus_1',
    stripeSubscriptionId: 'sub_1',
    additionalProfessionalBrands: 0,
    adminOverrideUnlimited: false,
    trialEndsAt: null,
    currentPeriodEnd: '2026-12-01T00:00:00.000Z',
    cancelAtPeriodEnd: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function makeLimits(overrides: Partial<ApiPlanLimits> = {}): ApiPlanLimits {
  return {
    tier: 'pro',
    includedBrands: 1,
    allowedAccountTypes: ['professional'],
    additionalBrandPriceBrl: 79,
    maxAutonomyLevel: 'automatic',
    maxAutoPostsPerDayCeiling: 2,
    historyRetentionDays: 180,
    monthlyCreditsIncluded: 200,
    allowTikTokVideo: true,
    allowPhotoCampaigns: true,
    allowPerformanceAnalytics: true,
    ...overrides,
  }
}

function makeCredits(overrides: Partial<ApiCreditState> = {}): ApiCreditState {
  return {
    periodKey: '2026-11',
    planRemaining: 150,
    purchasedRemaining: 0,
    totalAvailable: 150,
    ...overrides,
  }
}

describe('BillingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    subscriptionMock.current = { subscription: null, limits: null, credits: null, loading: true }
  })

  it('mostra carregando enquanto o plano não chegou', () => {
    render(<BillingPage />)
    expect(screen.getByText('Carregando…')).toBeInTheDocument()
  })

  it('mostra o plano atual e os limites', async () => {
    subscriptionMock.current = {
      subscription: makeSubscription(),
      limits: makeLimits(),
      credits: makeCredits(),
      loading: false,
    }

    render(<BillingPage />)

    expect(await screen.findByText('Plano atual: Pro')).toBeInTheDocument()
    expect(screen.getByText('Ativa')).toBeInTheDocument()
  })

  it('mostra o saldo de créditos do mês', async () => {
    subscriptionMock.current = {
      subscription: makeSubscription(),
      limits: makeLimits(),
      credits: makeCredits({ planRemaining: 120, purchasedRemaining: 30, totalAvailable: 150 }),
      loading: false,
    }

    render(<BillingPage />)

    expect(await screen.findByText('Créditos de IA este mês')).toBeInTheDocument()
    expect(screen.getByText('120')).toBeInTheDocument()
    expect(screen.getByText('30')).toBeInTheDocument()
    expect(screen.getByText('150')).toBeInTheDocument()
  })

  it('mostra o botão de gerenciar assinatura num plano pago e abre o portal ao clicar', async () => {
    subscriptionMock.current = {
      subscription: makeSubscription(),
      limits: makeLimits(),
      credits: makeCredits(),
      loading: false,
    }
    mockedApi.createPortalSession.mockResolvedValue('https://billing.stripe.com/p/123')
    const originalLocation = window.location
    Object.defineProperty(window, 'location', { value: { ...originalLocation, href: '' }, writable: true })

    render(<BillingPage />)
    fireEvent.click(await screen.findByText(/Gerenciar assinatura/))

    await waitFor(() => expect(window.location.href).toBe('https://billing.stripe.com/p/123'))
    Object.defineProperty(window, 'location', { value: originalLocation, writable: true })
  })

  it('não mostra o botão de gerenciar assinatura no plano grátis', async () => {
    subscriptionMock.current = {
      subscription: makeSubscription({ tier: 'free', stripeCustomerId: null, status: 'active' }),
      limits: makeLimits({ tier: 'free' }),
      credits: makeCredits({ planRemaining: 30, totalAvailable: 30 }),
      loading: false,
    }

    render(<BillingPage />)

    await screen.findByText('Plano atual: Grátis')
    expect(screen.queryByText(/Gerenciar assinatura/)).not.toBeInTheDocument()
  })
})
