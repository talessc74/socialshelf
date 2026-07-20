'use client'

import { useState } from 'react'
import { useTheme } from '../../contexts/ThemeContext'
import { ShelfScene } from '../../components/shelf/ShelfScene'
import { FlipClock } from '../../components/shelf/FlipClock'
import { OpenBookSheet } from '../../components/shelf/OpenBookSheet'
import { SHELF_SECTIONS, type ShelfSectionId } from '../../lib/shelfSections'

/**
 * Nova entrada da /dashboard (modo 'shelf'). Renderiza por breakpoint: flip
 * clock no mobile (<md) e prateleira 3D no desktop (≥md). Ao abrir uma seção,
 * o livro vira a folha-tema (OpenBookSheet), que leva à rota real.
 *
 * Ainda gated por admin (ver o seletor em page.tsx): o novo visual sobe
 * desligado por padrão e só quem tem o interruptor chega aqui.
 */
export function ShelfHome() {
  const { resolvedTheme } = useTheme()
  const [openId, setOpenId] = useState<ShelfSectionId | null>(null)
  const openSection = openId ? SHELF_SECTIONS.find((s) => s.id === openId) : null

  if (openSection) {
    return (
      <OpenBookSheet
        section={openSection}
        isLight={resolvedTheme !== 'dark'}
        onClose={() => setOpenId(null)}
      />
    )
  }

  return (
    <>
      <div className="md:hidden">
        <FlipClock onOpen={(s) => setOpenId(s.id)} />
      </div>
      <div className="hidden md:block">
        <ShelfScene onOpen={(s) => setOpenId(s.id)} />
      </div>
    </>
  )
}
