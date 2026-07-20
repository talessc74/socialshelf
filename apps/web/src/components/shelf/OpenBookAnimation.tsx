'use client'

import { useEffect, useState } from 'react'
import type { ShelfSection } from '../../lib/shelfSections'
import { CoverArt } from './BookCover'
import { sceneBackground } from './OpenBookSheet'

const BOOK_W = 310
const BOOK_H = 410
const EASE = 'cubic-bezier(0.645, 0.045, 0.355, 1)'

/**
 * Animação de abrir o livro (desktop, Fase 2). O livro 3D flutua e a capa gira
 * de 0 a -180° revelando o miolo; timings/camadas portados do protótipo. Depois
 * dela, o ShelfHome troca para a folha-tema (OpenBookSheet).
 *
 * Abrir: monta com a capa fechada (0°); ~60ms depois a capa gira para -180°.
 * Fechar (reverse): monta com a capa aberta (-180°); ~80ms depois volta a 0°.
 * O ShelfHome troca de fase quando a animação termina.
 */
export function OpenBookAnimation({
  section,
  isLight = true,
  reverse = false,
}: {
  section: ShelfSection
  isLight?: boolean
  reverse?: boolean
}) {
  const [angle, setAngle] = useState(reverse ? -180 : 0)
  useEffect(() => {
    const t = setTimeout(() => setAngle(reverse ? 0 : -180), reverse ? 80 : 60)
    return () => clearTimeout(t)
  }, [reverse])

  const dark = section.colorDark

  return (
    <div
      className="flex min-h-[calc(100vh-8rem)] items-center justify-center"
      style={{ background: sceneBackground(isLight), perspective: 2300, perspectiveOrigin: '50% 36%' }}
    >
      <div
        className="ss-book-float relative"
        style={{ width: BOOK_W, height: BOOK_H, transformStyle: 'preserve-3d' }}
      >
        {/* contra-capa */}
        <div style={{ position: 'absolute', inset: 0, transform: 'translateZ(-17px)', borderRadius: '4px 10px 10px 4px', background: `linear-gradient(135deg, ${dark}, #0a0a0a)` }} />

        {/* bloco de páginas */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            transform: 'translateZ(-15px)',
            borderRadius: '2px 6px 6px 2px',
            background: 'linear-gradient(to right, #fdf8f0, #ede5d5)',
            boxShadow: '3px 0 0 #ece4d2, 5px 0 0 #e8e0ce, 7px 0 0 #e4dcca, 9px 0 0 #e0d8c6',
          }}
        />

        {/* lombada */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: 17,
            height: BOOK_H,
            transformOrigin: 'left center',
            transform: 'rotateY(-90deg) translateX(-8.5px)',
            background: `linear-gradient(to right, ${dark}, ${dark}cc)`,
          }}
        />

        {/* folhas que acompanham a capa (fan) */}
        {[0.28, 0.16, 0.08].map((frac, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              inset: 0,
              transformOrigin: 'left center',
              transform: `rotateY(${angle * frac}deg)`,
              transition: `transform 0.88s ${[0.04, 0.02, 0][i]}s ${EASE}`,
              background: 'linear-gradient(to right, #fdf8f0, #f0e8d8)',
              borderRadius: '2px 4px 4px 2px',
              backfaceVisibility: 'hidden',
            }}
          />
        ))}

        {/* capa que gira */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            transformOrigin: 'left center',
            transform: `rotateY(${angle}deg)`,
            transition: `transform 0.88s ${EASE}`,
            transformStyle: 'preserve-3d',
          }}
        >
          {/* face externa (a capa do livro) */}
          <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', borderRadius: '2px 8px 8px 2px', overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.4)' }}>
            <CoverArt id={section.id} fill />
            <div
              className="ss-book-shine"
              aria-hidden
              style={{ position: 'absolute', top: 0, bottom: 0, width: '40%', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)', pointerEvents: 'none' }}
            />
          </div>
          {/* face interna (verso da capa) */}
          <div style={{ position: 'absolute', inset: 0, transform: 'rotateY(180deg)', backfaceVisibility: 'hidden', background: 'linear-gradient(160deg, #fdf8f0, #f5ede0)', borderRadius: '8px 2px 2px 8px', boxShadow: 'inset 3px 0 8px rgba(0,0,0,0.06)' }} />
        </div>
      </div>
    </div>
  )
}
