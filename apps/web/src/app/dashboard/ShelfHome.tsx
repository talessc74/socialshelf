'use client'

import { ShelfScene } from '../../components/shelf/ShelfScene'
import { FlipClock } from '../../components/shelf/FlipClock'

/**
 * Nova entrada da /dashboard (modo 'shelf'). Renderiza por breakpoint: flip
 * clock no mobile (<md) e prateleira 3D no desktop (≥md). Cada capa/seção leva
 * à rota real que já existe — a metáfora é só a porta de entrada.
 *
 * Ainda gated por admin (ver o seletor em page.tsx): o novo visual sobe
 * desligado por padrão e só quem tem o interruptor chega aqui.
 */
export function ShelfHome() {
  return (
    <>
      <div className="md:hidden">
        <FlipClock />
      </div>
      <div className="hidden md:block">
        <ShelfScene />
      </div>
    </>
  )
}
