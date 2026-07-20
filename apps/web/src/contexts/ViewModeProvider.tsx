'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from './AuthContext'
import { ViewModeContext, type ViewModeContextValue } from './ViewModeContext'
import { DEFAULT_VIEW_MODE, isAdminEmail, readViewMode, writeViewMode, type ViewMode } from '../lib/viewMode'

/**
 * Provider do interruptor de visual. Isolado do hook (ViewModeContext.tsx)
 * porque importa useAuth — e AuthContext inicializa o Firebase no import.
 * Só quem monta o provider (o layout do dashboard) carrega essa dependência.
 */
export function ViewModeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const userId = user?.uid ?? null
  const isAdmin = isAdminEmail(user?.email)

  const [hydrated, setHydrated] = useState(false)
  const [viewMode, setViewModeState] = useState<ViewMode>(DEFAULT_VIEW_MODE)

  // Lê a preferência só no cliente (e sempre que o usuário muda) — no SSR/primeiro
  // render fica no padrão, então o público sempre vê a home clássica sem flash.
  useEffect(() => {
    setViewModeState(readViewMode(userId))
    setHydrated(true)
  }, [userId])

  const setViewMode = useCallback(
    (mode: ViewMode) => {
      if (!userId) return
      writeViewMode(userId, mode)
      setViewModeState(mode)
    },
    [userId],
  )

  const value = useMemo<ViewModeContextValue>(
    () => ({ viewMode, setViewMode, isAdmin, canToggle: isAdmin, hydrated }),
    [viewMode, setViewMode, isAdmin, hydrated],
  )

  return <ViewModeContext.Provider value={value}>{children}</ViewModeContext.Provider>
}
