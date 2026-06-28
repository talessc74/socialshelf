'use client'

import { useEffect, useState } from 'react'
import { useTheme } from '../contexts/ThemeContext'

/**
 * Lanterna de troca de tema — inspirada na lanterna do Lanterna Verde.
 * É o objeto sozinho (sem círculo em volta): acesa (núcleo brilhando) no modo
 * escuro, apagada no claro. Clicar alterna o tema e vale como escolha manual.
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
      className={`group relative -m-1 flex items-center justify-center p-1 text-ink transition-transform hover:scale-110 active:scale-95 ${className}`}
    >
      {/* halo de luz quando acesa — gradiente radial colado à lanterna,
          forte no centro e escurecendo rápido até sumir nas bordas.
          Renderizado antes do SVG para que a lanterna fique por cima. */}
      {lit && (
        <span
          aria-hidden
          className="ss-glow-pulse pointer-events-none absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            background:
              'radial-gradient(circle, rgba(255,107,74,0.85) 22%, rgba(255,107,74,0.45) 42%, transparent 64%)',
          }}
        />
      )}
      <svg
        viewBox="0 0 24 28"
        className="relative h-8 w-8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* alça */}
        <path d="M9 5a3 3 0 0 1 6 0" />
        {/* tampa superior */}
        <path d="M7.5 7.5h9" />
        <path d="M8.4 7.5 7.4 10h9.2l-1-2.5" />
        {/* corpo da lanterna */}
        <rect x="6" y="10" width="12" height="12" rx="2.6" />
        {/* base */}
        <path d="M8.2 22l-.8 2h9.2l-.8-2" />
        {/* núcleo luminoso */}
        <circle
          cx="12"
          cy="16"
          r="3.4"
          fill={lit ? 'var(--ss-accent)' : 'none'}
          stroke={lit ? 'var(--ss-accent)' : 'currentColor'}
          className={lit ? 'drop-shadow-[0_0_6px_var(--ss-accent)]' : ''}
        />
      </svg>
    </button>
  )
}
