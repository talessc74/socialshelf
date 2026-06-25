'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { useAuth } from './AuthContext'
import { api, setActiveBrandId as setApiActiveBrandId } from '../lib/api'
import type { ApiBrand } from '../lib/api'

interface BrandContextValue {
  brands: ApiBrand[]
  activeBrand: ApiBrand | null
  activeBrandId: string | null
  setActiveBrandId: (brandId: string) => void
  loading: boolean
}

const BrandContext = createContext<BrandContextValue>({
  brands: [],
  activeBrand: null,
  activeBrandId: null,
  setActiveBrandId: () => {},
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

  const activeBrand = brands.find((b) => b.id === activeBrandId) ?? null

  return (
    <BrandContext.Provider value={{ brands, activeBrand, activeBrandId, setActiveBrandId, loading }}>
      {children}
    </BrandContext.Provider>
  )
}

export function useBrand() {
  return useContext(BrandContext)
}
