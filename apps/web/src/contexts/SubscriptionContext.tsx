'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { useAuth } from './AuthContext'
import { api } from '../lib/api'
import type { ApiSubscription, ApiPlanLimits, ApiCreditState } from '../lib/api'

interface SubscriptionContextValue {
  subscription: ApiSubscription | null
  limits: ApiPlanLimits | null
  credits: ApiCreditState | null
  loading: boolean
  refresh: () => Promise<void>
  // Saldo de créditos muda a cada geração — separado de refresh() pra telas que só precisam
  // de um número atualizado na hora (ex. CreditConfirmModal antes/depois de gerar) sem
  // recarregar subscription/limits, que raramente mudam no meio de uma sessão.
  refreshCredits: () => Promise<ApiCreditState | null>
}

const SubscriptionContext = createContext<SubscriptionContextValue>({
  subscription: null,
  limits: null,
  credits: null,
  loading: true,
  refresh: async () => {},
  refreshCredits: async () => null,
})

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [subscription, setSubscription] = useState<ApiSubscription | null>(null)
  const [limits, setLimits] = useState<ApiPlanLimits | null>(null)
  const [credits, setCredits] = useState<ApiCreditState | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const data = await api.getSubscription()
    setSubscription(data.subscription)
    setLimits(data.limits)
  }, [])

  const refreshCredits = useCallback(async () => {
    const data = await api.getCreditBalance()
    setCredits(data)
    return data
  }, [])

  useEffect(() => {
    if (!user) {
      setSubscription(null)
      setLimits(null)
      setCredits(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    Promise.all([api.getSubscription(), api.getCreditBalance()])
      .then(([subscriptionData, creditsData]) => {
        if (cancelled) return
        setSubscription(subscriptionData.subscription)
        setLimits(subscriptionData.limits)
        setCredits(creditsData)
      })
      .catch(() => {
        // Falha ao carregar o plano não deve travar o dashboard inteiro — páginas que
        // dependem de limits/credits tratam null como "ainda não sei", não "sem acesso a nada".
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [user])

  return (
    <SubscriptionContext.Provider value={{ subscription, limits, credits, loading, refresh, refreshCredits }}>
      {children}
    </SubscriptionContext.Provider>
  )
}

export function useSubscription() {
  return useContext(SubscriptionContext)
}
