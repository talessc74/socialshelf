'use client'

import { useEffect, useState } from 'react'
import { useSelfie, useSelfieDismissal } from '../contexts/AssistantContext'
import { SelfieChatPanel } from './SelfieChatPanel'
import { SelfieMascot } from './SelfieMascot'

/**
 * Selfie — assistente contextual do produto (ver _local-bdr-policy-011, emenda 2026-11-23).
 *
 * A narração (balão de fala) continua seguindo a regra original: só aparece por evento de
 * estado real, nunca por ociosidade. O que mudou na emenda: o mascote em si passou a ficar
 * sempre visível (uma vez hidratado e não dispensado) como um botão flutuante de ajuda — ele
 * precisa existir o tempo todo pro usuário poder clicar e abrir o chat a qualquer momento, não
 * só quando há uma dica em andamento. Isso é uma affordance estática (sempre no mesmo lugar,
 * nunca interrompe), diferente da narração proativa que a BDR-011 restringe.
 * O usuário pode desligar o Selfie inteiro pelo × — a preferência é persistida em localStorage
 * (escopo de dispositivo) e pode ser revertida pelo ícone do Selfie no TopNav (ver
 * useSelfieDismissal).
 */

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function Selfie() {
  const { narration, chat, openChat } = useSelfie()
  const { selfieDismissed, selfieHydrated, setSelfieDismissed } = useSelfieDismissal()
  const [reduceMotion, setReduceMotion] = useState(false)

  useEffect(() => {
    setReduceMotion(prefersReducedMotion())
  }, [])

  const dismiss = () => setSelfieDismissed(true)

  if (!selfieHydrated || selfieDismissed) return null

  if (chat.open) {
    return <SelfieChatPanel animated={!reduceMotion} />
  }

  return (
    <div
      data-testid="selfie"
      className="fixed bottom-4 right-4 z-40 flex max-w-[calc(100vw-2rem)] items-end gap-2"
    >
      {narration.active && narration.message && (
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
      )}
      <button
        type="button"
        onClick={openChat}
        aria-label="Perguntar algo ao Selfie"
        title="Perguntar algo ao Selfie"
        className="rounded-full focus:outline-none focus:ring-2 focus:ring-accent"
      >
        <SelfieMascot animated={!reduceMotion} />
      </button>
    </div>
  )
}
