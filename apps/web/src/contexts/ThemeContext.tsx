'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

export type ThemePref = 'light' | 'dark' | 'system'
type Resolved = 'light' | 'dark'

const STORAGE_KEY = 'ss-theme'

interface ThemeContextValue {
  /** Preferência escolhida pelo usuário (ou 'system' = segue o SO). */
  theme: ThemePref
  /** Tema realmente aplicado agora ('light' | 'dark'). */
  resolvedTheme: Resolved
  /** Define explicitamente uma preferência. */
  setTheme: (t: ThemePref) => void
  /** Alterna claro↔escuro e passa a ser uma escolha manual. */
  toggle: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
}

function resolve(pref: ThemePref): Resolved {
  if (pref === 'system') return systemPrefersDark() ? 'dark' : 'light'
  return pref
}

function applyClass(resolved: Resolved) {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle('dark', resolved === 'dark')
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Lê a preferência já gravada (o script anti-flash no <head> aplicou a classe
  // antes da hidratação; aqui só sincronizamos o estado do React).
  const [theme, setThemeState] = useState<ThemePref>(() => {
    if (typeof window === 'undefined') return 'system'
    return (localStorage.getItem(STORAGE_KEY) as ThemePref) ?? 'system'
  })
  const [resolvedTheme, setResolvedTheme] = useState<Resolved>(() => resolve(theme))

  // Aplica a classe sempre que a preferência muda.
  useEffect(() => {
    const r = resolve(theme)
    setResolvedTheme(r)
    applyClass(r)
  }, [theme])

  // Quando segue o sistema, reage às mudanças do SO em tempo real.
  useEffect(() => {
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      const r = systemPrefersDark() ? 'dark' : 'light'
      setResolvedTheme(r)
      applyClass(r)
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [theme])

  const setTheme = useCallback((t: ThemePref) => {
    if (t === 'system') localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, t)
    setThemeState(t)
  }, [])

  const toggle = useCallback(() => {
    setThemeState((current) => {
      const next: Resolved = resolve(current) === 'dark' ? 'light' : 'dark'
      localStorage.setItem(STORAGE_KEY, next)
      return next
    })
  }, [])

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme, toggle }),
    [theme, resolvedTheme, setTheme, toggle],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme deve ser usado dentro de <ThemeProvider>')
  return ctx
}
