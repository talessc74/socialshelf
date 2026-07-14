'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
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

// Arte oficial do Selfie. Se o arquivo existir em apps/web/public, é ele que
// aparece; senão, cai no mascote SVG abaixo. Colocar um PNG com fundo
// transparente para o personagem flutuar sem caixa de fundo.
const SELFIE_IMAGE_SRC = '/selfie.png'

// Sparkles do rastro de partículas — posição/tamanho/atraso conforme o
// handoff de design (design_handoff_selfie_solo/README.md).
const SPARKLES = [
  { dx: -18, dy: 6, delay: 0, size: 5 },
  { dx: 14, dy: 10, delay: 0.6, size: 4 },
  { dx: -8, dy: 16, delay: 1.2, size: 4.5 },
  { dx: 20, dy: 3, delay: 1.8, size: 3 },
]

/**
 * Agenda piscadas com cadência natural: intervalo aleatório de 2200-4800ms,
 * ~28% de chance de piscada dupla (dois blinks de 130ms separados por
 * ~150ms) — mesma lógica do protótipo do handoff. Não agenda nada quando
 * `enabled` é falso (reduced motion), e limpa os timers no unmount.
 */
function useSelfieBlink(enabled: boolean): boolean {
  const [blinking, setBlinking] = useState(false)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    if (!enabled) return undefined

    const clearAll = () => {
      timers.current.forEach(clearTimeout)
      timers.current = []
    }

    const doBlink = (times: number) => {
      setBlinking(true)
      timers.current.push(
        setTimeout(() => {
          setBlinking(false)
          if (times > 1) {
            timers.current.push(setTimeout(() => doBlink(1), 150))
          } else {
            scheduleNext()
          }
        }, 130),
      )
    }

    const scheduleNext = () => {
      const delay = 2200 + Math.random() * 2600
      timers.current.push(
        setTimeout(() => {
          doBlink(Math.random() < 0.28 ? 2 : 1)
        }, delay),
      )
    }

    scheduleNext()
    return clearAll
  }, [enabled])

  return enabled && blinking
}

/**
 * Mascote do Selfie. Prefere a arte oficial (SELFIE_IMAGE_SRC); se a imagem
 * não carregar, usa o SVG inline como fallback — assim a UI nunca fica sem
 * mascote. Todas as camadas de "estar vivo" (flutuar, respirar, olhar em
 * volta, piscar, partículas) só rodam quando `animated` é true — sob
 * prefers-reduced-motion, é uma imagem estática, sem timers rodando.
 */
function SelfieMascot({ animated }: { animated: boolean }) {
  const [imageFailed, setImageFailed] = useState(false)
  const blinking = useSelfieBlink(animated && !imageFailed)
  const floatClass = animated ? 'ss-selfie-float' : ''
  const breatheClass = animated ? 'ss-selfie-breathe' : ''
  const lookClass = animated ? 'ss-selfie-look' : ''

  return (
    <div className="flex shrink-0 flex-col items-center">
      <div
        className={`relative w-[84px] aspect-[410/510] drop-shadow-[0_0_14px_var(--ss-accent)] ${floatClass}`}
      >
        <div className={`relative h-full w-full ${breatheClass}`}>
          {!imageFailed ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={SELFIE_IMAGE_SRC}
                alt=""
                aria-hidden
                onError={() => setImageFailed(true)}
                className={`h-full w-full object-contain ${lookClass}`}
              />
              {animated && (
                <div
                  data-testid="selfie-eyelid"
                  aria-hidden
                  className="pointer-events-none absolute left-[35%] top-[19%] h-[27%] w-[31%] origin-top rounded-[50%_50%_48%_48%] transition-transform ease-in-out"
                  style={{
                    background: 'linear-gradient(180deg, #8fdadd 0%, #7ed0c6 100%)',
                    transform: `scaleY(${blinking ? 1 : 0})`,
                    transitionDuration: blinking ? '90ms' : '130ms',
                  }}
                />
              )}
            </>
          ) : (
            <svg aria-hidden viewBox="0 0 64 72" className={`h-full w-full ${lookClass}`}>
              <defs>
                {/* stop-color/fill precisam vir via style (CSS) — var() não
                    resolve em atributo de apresentação SVG na maioria dos
                    navegadores. */}
                <linearGradient id="selfie-body" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" style={{ stopColor: 'var(--ss-accent)' }} />
                  <stop offset="100%" style={{ stopColor: 'var(--ss-positive)' }} />
                </linearGradient>
              </defs>
              {/* rastro de luz */}
              <ellipse cx="32" cy="66" rx="9" ry="3" opacity="0.35" style={{ fill: 'var(--ss-accent)' }} />
              {/* corpo */}
              <path
                d="M32 6c13 0 21 9 21 22 0 6-1 11-4 16-3 6-9 10-17 10s-14-4-17-10c-3-5-4-10-4-16C11 15 19 6 32 6Z"
                fill="url(#selfie-body)"
              />
              {/* olho */}
              <circle cx="32" cy="30" r="10" fill="#ffffff" />
              <circle cx="32" cy="30" r="4.5" style={{ fill: 'var(--ss-ink)' }} />
            </svg>
          )}
        </div>

        {animated && (
          <div aria-hidden className="pointer-events-none absolute inset-0">
            {SPARKLES.map((s, i) => (
              <span
                key={i}
                className="ss-selfie-sparkle absolute rounded-full"
                style={
                  {
                    bottom: `${4 + s.dy}%`,
                    left: `calc(50% + ${s.dx}px)`,
                    width: `${s.size}px`,
                    height: `${s.size}px`,
                    background: 'var(--ss-accent)',
                    boxShadow: '0 0 7px var(--ss-accent)',
                    '--ss-sparkle-x': `${s.dx * 0.6}px`,
                    '--ss-sparkle-delay': `${s.delay}s`,
                  } as CSSProperties
                }
              />
            ))}
          </div>
        )}
      </div>

      {/* sombra de chão — estática, presente em qualquer modo */}
      <div
        aria-hidden
        className="mt-0.5 h-2 w-11 rounded-full bg-black/20 blur-[3px]"
      />
    </div>
  )
}
