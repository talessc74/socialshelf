'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { useAuth } from './AuthContext'
import { api } from '../lib/api'
import type { ApiSubscription, ApiPlanLimits } from '../lib/api'

interface SubscriptionContextValue {
  subscription: ApiSubscription | null
  limits: ApiPlanLimits | null
  loading: boolean
  refresh: () => Promise<void>
}

const SubscriptionContext = createContext<SubscriptionContextValue>({
  subscription: null,
  limits: null,
  loading: true,
  refresh: async () => {},
})

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [subscription, setSubscription] = useState<ApiSubscription | null>(null)
  const [limits, setLimits] = useState<ApiPlanLimits | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const data = await api.getSubscription()
    setSubscription(data.subscription)
    setLimits(data.limits)
  }, [])

  useEffect(() => {
    if (!user) {
      setSubscription(null)
      setLimits(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    api
      .getSubscription()
      .then((data) => {
        if (cancelled) return
        setSubscription(data.subscription)
        setLimits(data.limits)
      })
      .catch(() => {
        // Falha ao carregar o plano não deve travar o dashboard inteiro — páginas que
        // dependem de limits tratam null como "ainda não sei", não "sem acesso a nada".
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [user])

  return (
    <SubscriptionContext.Provider value={{ subscription, limits, loading, refresh }}>
      {children}
    </SubscriptionContext.Provider>
  )
}

export function useSubscription() {
  return useContext(SubscriptionContext)
}
