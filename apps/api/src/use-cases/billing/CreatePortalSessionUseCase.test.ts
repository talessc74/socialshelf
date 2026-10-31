import { describe, it, expect, vi, beforeEach } from 'vitest'
import type Stripe from 'stripe'
import { CreatePortalSessionUseCase } from './CreatePortalSessionUseCase.js'

describe('CreatePortalSessionUseCase', () => {
  let useCase: CreatePortalSessionUseCase
  let mockStripe: Stripe

  beforeEach(() => {
    mockStripe = {
      billingPortal: {
        sessions: {
          create: vi.fn().mockResolvedValue({ url: 'https://billing.stripe.com/portal-session-123' }),
        },
      },
    } as unknown as Stripe
    useCase = new CreatePortalSessionUseCase(mockStripe)
  })

  it('cria a sessão do Portal pro customer certo e devolve a url', async () => {
    const result = await useCase.execute('cus_123', 'https://app.com')

    expect(result).toEqual({ url: 'https://billing.stripe.com/portal-session-123' })
    expect(mockStripe.billingPortal.sessions.create).toHaveBeenCalledWith({
      customer: 'cus_123',
      return_url: 'https://app.com/dashboard/billing',
    })
  })
})
