'use client'

import { useRouter } from 'next/navigation'
import { useTheme } from '../../contexts/ThemeContext'
import { SHELF_SECTIONS, SHELF_ROW_1, SHELF_ROW_2, type ShelfSection, type ShelfSectionId } from '../../lib/shelfSections'
import { BookCover } from './BookCover'

const BOOK_GAP = 10

const PLANK = {
  height: 20,
  borderRadius: 3,
  background: 'linear-gradient(to bottom, #b87333, #8b5520 45%, #6b3e12)',
  boxShadow:
    '0 4px 18px rgba(0,0,0,0.65), inset 0 2px 3px rgba(255,200,100,0.12), inset 0 -1px 2px rgba(0,0,0,0.3)',
}

function byId(ids: ShelfSectionId[]): ShelfSection[] {
  return ids.map((id) => SHELF_SECTIONS.find((s) => s.id === id)!).filter(Boolean)
}

function Shelf({ ids, onOpen, labelColor }: { ids: ShelfSectionId[]; onOpen: (s: ShelfSection) => void; labelColor: string }) {
  const sections = byId(ids)
  // Largura da fileira = soma das capas + espaços entre elas. Mantém o plank e as
  // legendas exatamente sob os livros.
  const rowWidth = sections.reduce((sum, s) => sum + s.width, 0) + (sections.length - 1) * BOOK_GAP
  return (
    <div className="flex flex-col items-center">
      <div className="flex items-end justify-center" style={{ gap: BOOK_GAP }}>
        {sections.map((section) => (
          <button
            key={section.id}
            type="button"
            onClick={() => onOpen(section)}
            aria-label={`Abrir ${section.name}`}
            className="group cursor-pointer bg-transparent p-0 transition-transform duration-200 ease-out hover:-translate-y-[22px] focus-visible:-translate-y-[22px] focus-visible:outline-none"
          >
            <span className="block transition-[filter] duration-200 group-hover:[filter:brightness(1.1)]">
              <BookCover section={section} />
            </span>
          </button>
        ))}
      </div>
      {/* prateleira (plank), largura alinhada aos livros */}
      <div style={{ width: rowWidth }}>
        <div style={{ ...PLANK }} className="w-full" />
        <div className="mx-auto h-2 w-[92%] rounded-full" style={{ background: 'rgba(0,0,0,0.4)', filter: 'blur(6px)' }} />
      </div>
      {/* legendas alinhadas com os livros */}
      <div className="flex justify-center" style={{ gap: BOOK_GAP }}>
        {sections.map((section) => (
          <span
            key={section.id}
            className="text-center text-[10px] font-semibold uppercase"
            style={{ width: section.width, letterSpacing: '0.14em', color: labelColor }}
          >
            {section.label}
          </span>
        ))}
      </div>
    </div>
  )
}

function WallSwitch({ isDark, onToggle }: { isDark: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label="Interruptor de parede — alternar claro e escuro"
      aria-pressed={isDark}
      title={isDark ? 'Acender as luzes (claro)' : 'Apagar as luzes (escuro)'}
      className="absolute bottom-5 left-5 flex flex-col items-center gap-1"
    >
      <span
        className="flex h-14 w-9 items-end justify-center rounded-[7px] border p-1"
        style={{
          borderColor: isDark ? '#2a2118' : '#cbb48f',
          background: isDark ? 'linear-gradient(180deg,#241a10,#160f08)' : 'linear-gradient(180deg,#f4ead3,#e3d3ad)',
          boxShadow: 'inset 0 2px 3px rgba(255,255,255,0.25), inset 0 -3px 6px rgba(0,0,0,0.35), 0 2px 6px rgba(0,0,0,0.4)',
        }}
      >
        <span
          className="h-5 w-full rounded-[3px] transition-transform duration-200"
          style={{
            background: isDark ? '#3a2c1a' : '#d8b24a',
            transform: isDark ? 'translateY(0)' : 'translateY(-24px)',
            boxShadow: '0 1px 2px rgba(0,0,0,0.5)',
          }}
        />
      </span>
    </button>
  )
}

/**
 * Prateleira 3D — a nova entrada da /dashboard no desktop. Duas prateleiras
 * flutuantes com 7 livros; cada capa leva à rota real. O tema claro/escuro é
 * o interruptor de parede (reaproveita o ThemeContext — a "Lanterna" some no
 * modo prateleira, ver _local-bdr-policy-010). Padrão = claro.
 */
export function ShelfScene() {
  const router = useRouter()
  const { resolvedTheme, toggle } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const scene = isDark
    ? {
        background:
          'radial-gradient(120% 90% at 50% 0%, #3a2410 0%, #1c1006 42%, #150b04 100%)',
        title: '#c9a84c',
        subtitle: 'rgba(201,168,76,0.55)',
        label: 'rgba(201,168,76,0.55)',
        tagline: 'rgba(201,168,76,0.3)',
      }
    : {
        background:
          'radial-gradient(120% 90% at 50% 0%, #fbf3e0 0%, #eeddbe 45%, #d9c199 100%)',
        title: '#6b4a1c',
        subtitle: 'rgba(107,74,28,0.6)',
        label: 'rgba(107,74,28,0.6)',
        tagline: 'rgba(107,74,28,0.4)',
      }

  const onOpen = (section: ShelfSection) => router.push(section.route)

  return (
    <div
      className="relative flex min-h-[calc(100vh-8rem)] flex-col items-center gap-8 rounded-3xl px-4 pb-12 pt-10"
      style={{ background: scene.background }}
    >
      <div className="text-center">
        <h1
          className="font-cinzel text-[44px] font-normal leading-none"
          style={{ color: scene.title, letterSpacing: '0.22em', textShadow: isDark ? '0 0 24px rgba(201,168,76,0.35)' : 'none' }}
        >
          SOCIALSHELF
        </h1>
        <p className="mt-3 text-[15px] italic" style={{ color: scene.subtitle, letterSpacing: '0.04em' }}>
          Clique em um livro para abrir
        </p>
      </div>

      <div className="flex flex-col items-center gap-10">
        <Shelf ids={SHELF_ROW_1} onOpen={onOpen} labelColor={scene.label} />
        <Shelf ids={SHELF_ROW_2} onOpen={onOpen} labelColor={scene.label} />
      </div>

      <p className="mt-2 text-[13px] italic" style={{ color: scene.tagline, letterSpacing: '0.08em' }}>
        — selecione um livro para abrir —
      </p>

      <WallSwitch isDark={isDark} onToggle={toggle} />
    </div>
  )
}
