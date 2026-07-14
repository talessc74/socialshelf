'use client'

import { useEffect, useState } from 'react'
import { useSelfie } from '../contexts/AssistantContext'

/**
 * Selfie — assistente contextual do produto (ver _local-bdr-policy-011).
 *
 * Primeiro corte: aparece apenas enquanto a IA está trabalhando (evento de
 * estado real publicado via useSelfieNarration), narrando cada estágio. Nunca
 * aparece por ociosidade. O usuário pode desligá-lo de vez — a preferência é
 * persistida em localStorage (escopo de dispositivo neste corte; migra para
 * Firestore por usuário na onda de onboarding).
 */

const DISMISSED_KEY = 'socialshelf:selfie:dismissed'

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function Selfie() {
  const { narration } = useSelfie()
  // Começa oculto até lermos localStorage/matchMedia no cliente, evitando
  // flash de hidratação.
  const [hydrated, setHydrated] = useState(false)
  const [dismissed, setDismissed] = useState(true)
  const [reduceMotion, setReduceMotion] = useState(false)

  useEffect(() => {
    setDismissed(window.localStorage.getItem(DISMISSED_KEY) === '1')
    setReduceMotion(prefersReducedMotion())
    setHydrated(true)
  }, [])

  const dismiss = () => {
    window.localStorage.setItem(DISMISSED_KEY, '1')
    setDismissed(true)
  }

  if (!hydrated || dismissed || !narration.active || !narration.message) return null

  return (
    <div
      data-testid="selfie"
      className="fixed bottom-4 right-4 z-40 flex max-w-[calc(100vw-2rem)] items-end gap-2"
    >
      <div
        role="status"
        aria-live="polite"
        className="relative max-w-[220px] rounded-2xl border border-accent-soft bg-card px-4 py-3 text-sm text-ink shadow-card"
      >
        <p className="pr-4">{narration.message}</p>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Não mostrar mais o Selfie"
          className="absolute right-1.5 top-1.5 rounded-md px-1 text-xs leading-none text-muted hover:text-ink focus:outline-none focus:ring-2 focus:ring-accent"
        >
          ×
        </button>
      </div>
      <SelfieMascot animated={!reduceMotion} />
    </div>
  )
}

/**
 * Mascote em SVG inline, seguindo o padrão do repositório (ver LanternToggle):
 * corpo arredondado, olho único brilhando, gradiente ciano→verde do logo
 * (BDR-010), rastro de luz. A flutuação só é aplicada quando o usuário não
 * pediu redução de movimento — dupla proteção (classe condicional + media
 * query em globals.css).
 */
function SelfieMascot({ animated }: { animated: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 64 72"
      className={`h-16 w-16 shrink-0 drop-shadow-[0_0_10px_var(--ss-accent)] ${animated ? 'ss-selfie-float' : ''}`}
    >
      <defs>
        <linearGradient id="selfie-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--ss-accent)" />
          <stop offset="100%" stopColor="var(--ss-positive)" />
        </linearGradient>
      </defs>
      {/* rastro de luz */}
      <ellipse cx="32" cy="66" rx="9" ry="3" fill="var(--ss-accent)" opacity="0.35" />
      {/* corpo */}
      <path
        d="M32 6c13 0 21 9 21 22 0 6-1 11-4 16-3 6-9 10-17 10s-14-4-17-10c-3-5-4-10-4-16C11 15 19 6 32 6Z"
        fill="url(#selfie-body)"
      />
      {/* olho */}
      <circle cx="32" cy="30" r="10" fill="#ffffff" />
      <circle cx="32" cy="30" r="4.5" fill="var(--ss-ink)" />
    </svg>
  )
}
