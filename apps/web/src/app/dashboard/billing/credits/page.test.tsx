import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import CreditsPage from './page'
import { api } from '../../../../lib/api'
import type { ApiCreditState } from '../../../../lib/api'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}))

vi.mock('../../../../lib/api', () => ({
  api: {
    createCreditsCheckoutSession: vi.fn(),
  },
}))

const subscriptionMock = vi.hoisted(() => ({
  current: { credits: null as ApiCreditState | null },
}))
vi.mock('../../../../contexts/SubscriptionContext', () => ({ useSubscription: () => subscriptionMock.current }))

const mockedApi = vi.mocked(api, true)

describe('CreditsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    subscriptionMock.current = { credits: null }
  })

  it('mostra os 3 pacotes com preço', () => {
    render(<CreditsPage />)

    expect(screen.getByText('50')).toBeInTheDocument()
    expect(screen.getByText('150')).toBeInTheDocument()
    expect(screen.getByText('400')).toBeInTheDocument()
    expect(screen.getByText('R$ 15')).toBeInTheDocument()
    expect(screen.getByText('R$ 45')).toBeInTheDocument()
    expect(screen.getByText('R$ 120')).toBeInTheDocument()
  })

  it('mostra o saldo atual quando disponível', () => {
    subscriptionMock.current = {
      credits: { periodKey: '2026-11', planRemaining: 20, purchasedRemaining: 5, totalAvailable: 25 },
    }

    render(<CreditsPage />)

    expect(screen.getByText(/25 créditos/)).toBeInTheDocument()
  })

  it('inicia o checkout do pacote de 150 créditos e redireciona pra url do Stripe', async () => {
    mockedApi.createCreditsCheckoutSession.mockResolvedValue('https://checkout.stripe.com/s/456')
    const originalLocation = window.location
    Object.defineProperty(window, 'location', { value: { ...originalLocation, href: '' }, writable: true })

    render(<CreditsPage />)
    const card = screen.getByText('150').closest('div')!.parentElement as HTMLElement
    fireEvent.click(within(card).getByText('Comprar'))

    await waitFor(() => expect(mockedApi.createCreditsCheckoutSession).toHaveBeenCalledWith(150))
    await waitFor(() => expect(window.location.href).toBe('https://checkout.stripe.com/s/456'))
    Object.defineProperty(window, 'location', { value: originalLocation, writable: true })
  })

  it('mostra erro quando o checkout falha', async () => {
    mockedApi.createCreditsCheckoutSession.mockRejectedValue(new Error('Falha ao iniciar checkout'))

    render(<CreditsPage />)
    const card = screen.getByText('50').closest('div')!.parentElement as HTMLElement
    fireEvent.click(within(card).getByText('Comprar'))

    expect(await screen.findByText('Falha ao iniciar checkout')).toBeInTheDocument()
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
