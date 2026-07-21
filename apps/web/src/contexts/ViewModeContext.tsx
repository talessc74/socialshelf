'use client'

import { createContext, useContext } from 'react'
import { DEFAULT_VIEW_MODE, type ViewMode } from '../lib/viewMode'

/**
 * Contexto + hook do interruptor de visual. Fica separado do provider (ver
 * ViewModeProvider.tsx) de propósito: este módulo não importa nada de auth/
 * firebase, então componentes compartilhados como o TopNav podem consumir o
 * hook sem arrastar a inicialização do Firebase para o grafo de import (o que
 * quebraria os testes desses componentes).
 */
export interface ViewModeContextValue {
  /** Preferência atual ('classic' | 'shelf'). */
  viewMode: ViewMode
  /** Grava a preferência do usuário. */
  setViewMode: (mode: ViewMode) => void
  /** Usuário é administrador (allowlist de e-mail). */
  isAdmin: boolean
  /**
   * Pode ver/usar o interruptor agora. Na Fase 0 = só admin (o novo visual
   * ainda não foi lançado ao público). No lançamento, passa a valer para todos.
   */
  canToggle: boolean
  /** false até montar no cliente — evita divergência SSR/hidratação. */
  hydrated: boolean
}

export const VIEW_MODE_DEFAULTS: ViewModeContextValue = {
  viewMode: DEFAULT_VIEW_MODE,
  setViewMode: () => {},
  isAdmin: false,
  canToggle: false,
  hydrated: false,
}

export const ViewModeContext = createContext<ViewModeContextValue | null>(null)

/**
 * Tolerante de propósito: fora de um <ViewModeProvider> devolve os defaults
 * (nada de admin, interruptor escondido) em vez de lançar. Assim o TopNav pode
 * ser montado isoladamente em teste sem o provider, e apenas não mostra o
 * interruptor.
 */
export function useViewMode(): ViewModeContextValue {
  return useContext(ViewModeContext) ?? VIEW_MODE_DEFAULTS
}
