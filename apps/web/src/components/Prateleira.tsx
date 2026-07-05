'use client'

import { useState, useCallback } from 'react'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { useAuth } from '../contexts/AuthContext'
import { useBrand } from '../contexts/BrandContext'
import { PrateleyraShelf } from './PrateleyraShelf'
import { PrateleyraAnimation } from './PrateleyraAnimation'
import { PrateleyraOpen } from './PrateleyraOpen'
import { PrateleyraCorner } from './PrateleyraCorner'

export type Phase = 'shelf' | 'animating' | 'open'
export type BookId = 'agenda' | 'noticias' | 'desempenho' | 'criar' | 'marca' | 'redes'

export interface Book {
  id: BookId
  label: string
  width: number
  height: number
  colorDark: string
  accent: string
  leftTitle: string
  rightTitle: string
  cta: string
}

export const BOOKS: Book[] = [
  {
    id: 'criar',
    label: 'CRIAR',
    width: 124,
    height: 182,
    colorDark: '#1a2a4a',
    accent: '#2850c8',
    leftTitle: 'Recentes',
    rightTitle: 'Gerar novo',
    cta: 'Abrir gerador',
  },
  {
    id: 'desempenho',
    label: 'DESEMPENHO',
    width: 113,
    height: 182,
    colorDark: '#0c1d3a',
    accent: '#e07850',
    leftTitle: 'Métricas',
    rightTitle: 'Analytics',
    cta: 'Ver relatório',
  },
  {
    id: 'noticias',
    label: 'NOTÍCIAS',
    width: 124,
    height: 182,
    colorDark: '#2a2a2a',
    accent: '#6b4010',
    leftTitle: 'Pautas',
    rightTitle: 'Buscar',
    cta: 'Explorar notícias',
  },
  {
    id: 'agenda',
    label: 'AGENDA',
    width: 112,
    height: 182,
    colorDark: '#1b2840',
    accent: '#c9a84c',
    leftTitle: 'Agendados',
    rightTitle: 'Calendário',
    cta: 'Gerenciar agenda',
  },
  {
    id: 'marca',
    label: 'MARCA',
    width: 110,
    height: 182,
    colorDark: '#1a1a1a',
    accent: '#1a1a1a',
    leftTitle: 'Identidade',
    rightTitle: 'Visual',
    cta: 'Configurar marca',
  },
  {
    id: 'redes',
    label: 'REDES',
    width: 130,
    height: 182,
    colorDark: '#0a1a2a',
    accent: '#0077b5',
    leftTitle: 'Conexões',
    rightTitle: 'Plataformas',
    cta: 'Gerenciar redes',
  },
]

export default function Prateleira() {
  const [phase, setPhase] = useState<Phase>('shelf')
  const [selectedBookId, setSelectedBookId] = useState<BookId | null>(null)
  const [coverAngle, setCoverAngle] = useState(0)

  const isMobile = useMediaQuery('(max-width: 768px)')
  const { user, logout } = useAuth()
  const { brands, activeBrandId, setActiveBrandId } = useBrand()

  const selectedBook = selectedBookId ? BOOKS.find((b) => b.id === selectedBookId) : null

  const handleBookClick = useCallback((bookId: BookId) => {
    setSelectedBookId(bookId)
    setPhase('animating')
    setCoverAngle(0)
    setTimeout(() => setCoverAngle(-180), 360)
    setTimeout(() => setPhase('open'), 1380)
  }, [])

  const handleClose = useCallback(() => {
    setPhase('animating')
    setCoverAngle(-180)
    setTimeout(() => setCoverAngle(0), 80)
    setTimeout(() => {
      setPhase('shelf')
      setSelectedBookId(null)
    }, 1100)
  }, [])

  return (
    <div className="relative w-full h-screen overflow-hidden bg-gradient-to-b from-[#150b04] via-[#1a0f06] to-[#0a0604]">
      {/* Ambient gradient overlays */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-gradient-radial from-[#4a3a2a] via-[#2a1a1a] to-transparent opacity-20 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-gradient-radial from-[#3a2a1a] via-[#1a0a00] to-transparent opacity-15 blur-3xl" />
      </div>

      <PrateleyraCorner
        email={user?.email ?? ''}
        brands={brands}
        activeBrandId={activeBrandId}
        onBrandChange={setActiveBrandId}
        onLogout={logout}
      />

      {/* Content container */}
      <div className="relative z-10 h-full flex flex-col">
        {phase === 'shelf' && (
          <PrateleyraShelf books={BOOKS} onBookClick={handleBookClick} isMobile={isMobile} />
        )}

        {phase === 'animating' && selectedBook && (
          <PrateleyraAnimation
            book={selectedBook}
            coverAngle={coverAngle}
            isMobile={isMobile}
          />
        )}

        {phase === 'open' && selectedBook && (
          <PrateleyraOpen
            book={selectedBook}
            onClose={handleClose}
            isMobile={isMobile}
          />
        )}
      </div>
    </div>
  )
}
