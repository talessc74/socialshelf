'use client'

import { useEffect, useRef, useState } from 'react'
import { useTheme } from '../../contexts/ThemeContext'
import { ShelfScene } from '../../components/shelf/ShelfScene'
import { FlipClock } from '../../components/shelf/FlipClock'
import { OpenBookAnimation } from '../../components/shelf/OpenBookAnimation'
import { OpenBookSheet } from '../../components/shelf/OpenBookSheet'
import { SHELF_SECTIONS, type ShelfSection, type ShelfSectionId } from '../../lib/shelfSections'

type Phase = 'shelf' | 'animating' | 'open' | 'closing'
// Tempos da animação da capa, do protótipo.
const OPEN_MS = 1380
const CLOSE_MS = 1100

/**
 * Nova entrada da /dashboard (modo 'shelf'). Renderiza por breakpoint: flip
 * clock no mobile (<md) e prateleira 3D no desktop (≥md).
 *
 * Abrir uma seção no desktop toca a animação 3D de virar a capa e então mostra
 * a folha-tema (OpenBookSheet). No mobile a abertura é direta (fade), sem 3D —
 * o flip clock já é a animação de entrada. A folha leva à rota real.
 *
 * Gated por admin (ver o seletor em page.tsx).
 */
export function ShelfHome() {
  const { resolvedTheme } = useTheme()
  const isLight = resolvedTheme !== 'dark'
  const [phase, setPhase] = useState<Phase>('shelf')
  const [activeId, setActiveId] = useState<ShelfSectionId | null>(null)
  // Se a abertura foi animada (desktop), o fechar também anima; no mobile, direto.
  const [animated, setAnimated] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  const active = activeId ? SHELF_SECTIONS.find((s) => s.id === activeId) ?? null : null

  // Desktop: anima a capa antes de abrir a folha.
  const openAnimated = (s: ShelfSection) => {
    setAnimated(true)
    setActiveId(s.id)
    setPhase('animating')
    timer.current = setTimeout(() => setPhase('open'), OPEN_MS)
  }
  // Mobile: abre direto.
  const openInstant = (s: ShelfSection) => {
    setAnimated(false)
    setActiveId(s.id)
    setPhase('open')
  }
  const close = () => {
    if (timer.current) clearTimeout(timer.current)
    if (animated) {
      setPhase('closing')
      timer.current = setTimeout(() => {
        setActiveId(null)
        setPhase('shelf')
      }, CLOSE_MS)
    } else {
      setActiveId(null)
      setPhase('shelf')
    }
  }

  if ((phase === 'animating' || phase === 'closing') && active) {
    return <OpenBookAnimation section={active} isLight={isLight} reverse={phase === 'closing'} />
  }
  if (phase === 'open' && active) {
    return <OpenBookSheet section={active} isLight={isLight} onClose={close} />
  }

  return (
    <>
      <div className="md:hidden">
        <FlipClock onOpen={openInstant} />
      </div>
      <div className="hidden md:block">
        <ShelfScene onOpen={openAnimated} />
      </div>
    </>
  )
}
