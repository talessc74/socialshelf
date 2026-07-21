'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { useAuth } from './AuthContext'
import { api, setActiveBrandId as setApiActiveBrandId } from '../lib/api'
import type { AccountType, ApiBrand } from '../lib/api'

interface BrandContextValue {
  brands: ApiBrand[]
  activeBrand: ApiBrand | null
  activeBrandId: string | null
  setActiveBrandId: (brandId: string) => void
  setAccountType: (brandId: string, accountType: AccountType) => Promise<void>
  loading: boolean
}

const BrandContext = createContext<BrandContextValue>({
  brands: [],
  activeBrand: null,
  activeBrandId: null,
  setActiveBrandId: () => {},
  setAccountType: async () => {},
  loading: true,
})

function storageKey(userId: string): string {
  return `socialshelf:activeBrandId:${userId}`
}

export function BrandProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [brands, setBrands] = useState<ApiBrand[]>([])
  const [activeBrandId, setActiveBrandIdState] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setBrands([])
      setActiveBrandIdState(null)
      setApiActiveBrandId(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    api
      .getBrands()
      .then((fetchedBrands) => {
        if (cancelled) return
        setBrands(fetchedBrands)

        const stored = localStorage.getItem(storageKey(user.uid))
        const initial = (stored && fetchedBrands.some((b) => b.id === stored) ? stored : fetchedBrands[0]?.id) ?? null

        setActiveBrandIdState(initial)
        setApiActiveBrandId(initial)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [user])

  const setActiveBrandId = useCallback(
    (brandId: string) => {
      setActiveBrandIdState(brandId)
      setApiActiveBrandId(brandId)
      if (user) localStorage.setItem(storageKey(user.uid), brandId)
    },
    [user],
  )

  const setAccountType = useCallback(async (brandId: string, accountType: AccountType) => {
    const updated = await api.updateBrandAccountType(brandId, accountType)
    setBrands((prev) => prev.map((b) => (b.id === brandId ? { ...b, accountType: updated.accountType } : b)))
  }, [])

  const activeBrand = brands.find((b) => b.id === activeBrandId) ?? null

  return (
    <BrandContext.Provider value={{ brands, activeBrand, activeBrandId, setActiveBrandId, setAccountType, loading }}>
      {children}
    </BrandContext.Provider>
  )
}

export function useBrand() {
  return useContext(BrandContext)
}
