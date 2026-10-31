import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import PlansPage from './page'
import { api } from '../../../../lib/api'
import type { ApiSubscription } from '../../../../lib/api'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}))

vi.mock('../../../../lib/api', () => ({
  api: {
    createCheckoutSession: vi.fn(),
  },
}))

const subscriptionMock = vi.hoisted(() => ({
  current: { subscription: null as ApiSubscription | null, limits: null, loading: false },
}))
vi.mock('../../../../contexts/SubscriptionContext', () => ({ useSubscription: () => subscriptionMock.current }))

const mockedApi = vi.mocked(api, true)

describe('PlansPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    subscriptionMock.current = { subscription: null, limits: null, loading: false }
  })

  it('mostra os 4 planos com o seletor mensal/anual, começando em mensal', () => {
    render(<PlansPage />)

    expect(screen.getByText('Grátis')).toBeInTheDocument()
    expect(screen.getByText('Starter')).toBeInTheDocument()
    expect(screen.getByText('Pro')).toBeInTheDocument()
    expect(screen.getByText('Agência')).toBeInTheDocument()
    expect(screen.getByText('R$ 29')).toBeInTheDocument()
  })

  it('troca pro preço anual ao clicar no seletor', () => {
    render(<PlansPage />)

    fireEvent.click(screen.getByText(/Anual/))

    expect(screen.getByText('R$ 290')).toBeInTheDocument()
  })

  it('inicia o checkout do plano Pro e redireciona pra url do Stripe', async () => {
    mockedApi.createCheckoutSession.mockResolvedValue('https://checkout.stripe.com/s/123')
    const originalLocation = window.location
    Object.defineProperty(window, 'location', { value: { ...originalLocation, href: '' }, writable: true })

    render(<PlansPage />)
    const proCard = screen.getByText('Pro').closest('div')!
    fireEvent.click(within(proCard.parentElement as HTMLElement).getByText('Assinar'))

    await waitFor(() => expect(mockedApi.createCheckoutSession).toHaveBeenCalledWith('pro', 'monthly'))
    await waitFor(() => expect(window.location.href).toBe('https://checkout.stripe.com/s/123'))
    Object.defineProperty(window, 'location', { value: originalLocation, writable: true })
  })

  it('mostra "Plano atual" em vez do botão Assinar pro tier já ativo', () => {
    subscriptionMock.current = {
      subscription: {
        userId: 'user-1',
        tier: 'starter',
        billingCycle: 'monthly',
        status: 'active',
        stripeCustomerId: 'cus_1',
        stripeSubscriptionId: 'sub_1',
        additionalProfessionalBrands: 0,
        adminOverrideUnlimited: false,
        trialEndsAt: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      limits: null,
      loading: false,
    }

    render(<PlansPage />)

    expect(screen.getAllByText('Plano atual').length).toBeGreaterThan(0)
  })
})

// Pequeno helper local pra não depender de @testing-library/dom's `within` named export em
// todo arquivo — evita um import extra só pra esse caso de uso único.
function within(element: HTMLElement) {
  return {
    getByText: (text: string) => {
      const match = Array.from(element.querySelectorAll('button')).find((el) => el.textContent === text)
      if (!match) throw new Error(`Not found: ${text}`)
      return match
    },
  }
}
