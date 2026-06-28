'use client'

import { useEffect, useState } from 'react'
import { useTheme } from '../contexts/ThemeContext'

/**
 * Lanterna de troca de tema — inspirada na lanterna do Lanterna Verde.
 * Acesa (núcleo brilhando) no modo escuro; apagada no claro.
 * Clicar alterna o tema e passa a valer como escolha manual.
 */
export function LanternToggle({ className = '' }: { className?: string }) {
  const { resolvedTheme, toggle } = useTheme()
  // Evita mismatch de hidratação: no SSR/primeiro render mostramos a lanterna
  // apagada (estado neutro) e só refletimos o tema real após montar no cliente.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const lit = mounted && resolvedTheme === 'dark'

  return (
    <button
      type="button"
      onClick={toggle}
      title={lit ? 'Acender as luzes (modo claro)' : 'Apagar as luzes (modo escuro)'}
      aria-label="Alternar tema claro e escuro"
      aria-pressed={lit}
      className={`group relative flex h-9 w-9 items-center justify-center rounded-full border border-line bg-card text-ink shadow-sm transition-colors hover:border-accent ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-[18px] w-[18px]"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* alça */}
        <path d="M9 4.5a3 3 0 0 1 6 0" />
        {/* tampa superior */}
        <path d="M8 6.5h8" />
        <path d="M8.8 6.5 8 8.5h8l-.8-2" />
        {/* corpo da lanterna */}
        <rect x="7" y="8.5" width="10" height="10" rx="2.4" />
        {/* base */}
        <path d="M9 18.5l-.6 1.5h7.2l-.6-1.5" />
        {/* núcleo luminoso */}
        <circle
          cx="12"
          cy="13.5"
          r="2.7"
          fill={lit ? 'var(--ss-accent)' : 'none'}
          stroke={lit ? 'var(--ss-accent)' : 'currentColor'}
          className={lit ? 'drop-shadow-[0_0_4px_var(--ss-accent)]' : ''}
        />
      </svg>
      {/* halo de luz quando acesa */}
      {lit && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{ boxShadow: '0 0 12px 1px var(--ss-accent)', opacity: 0.35 }}
        />
      )}
    </button>
  )
}
