'use client'

import { useRouter } from 'next/navigation'
import type { ShelfSection, ShelfSectionId } from '../../lib/shelfSections'
import { SECTION_DETAILS } from '../../lib/shelfSectionDetails'

/**
 * Folha aberta do livro (Fase 2) — a "segunda página". Ao abrir um livro, o
 * miolo aparece como uma folha plana com a identidade da seção (papel-tema
 * portado do protótipo: jornal em Notícias, blueprint em Desempenho, papel na
 * cor-tema nos demais), um filete de destaque que dá um flash, e o conteúdo
 * real da seção resumido com um CTA para a tela completa — onde toda a
 * funcionalidade de hoje continua intacta.
 */

interface Theme {
  paper: string
  pattern?: string
  patternSize?: string
  edge: string
  headFont: string
  masthead?: string
}

const CINZEL = 'var(--font-cinzel), Georgia, serif'
const GEORGIA = 'Georgia, "Times New Roman", serif'

const THEMES: Record<ShelfSectionId, Theme> = {
  noticias: {
    paper: '#f4ecd8',
    pattern:
      'repeating-linear-gradient(90deg, transparent, transparent 6px, rgba(26,26,26,0.03) 6px, rgba(26,26,26,0.035) 7px)',
    edge: '#1a1a1a',
    headFont: GEORGIA,
    masthead: 'THE SHELF GAZETTE',
  },
  desempenho: {
    paper: '#eaf0f9',
    pattern:
      'linear-gradient(rgba(30,70,140,0.09) 1px, transparent 1px), linear-gradient(90deg, rgba(30,70,140,0.09) 1px, transparent 1px)',
    patternSize: '22px 22px',
    edge: '#0c1d3a',
    headFont: CINZEL,
    masthead: 'BLUEPRINT · ANALYTICS',
  },
  agenda: { paper: '#f7f2e6', edge: '#1b2840', headFont: GEORGIA },
  criar: { paper: '#f6f5f0', edge: '#2850c8', headFont: CINZEL },
  campanhas: { paper: '#efece7', edge: '#2a2a26', headFont: GEORGIA, masthead: 'ENSAIOS · CAMPANHAS' },
  marca: { paper: '#f7f6f3', edge: '#1a1a1a', headFont: CINZEL },
  redes: { paper: '#eef3f6', edge: '#0077b5', headFont: CINZEL },
}

export function sceneBackground(isLight: boolean): string {
  return isLight
    ? 'radial-gradient(120% 90% at 50% 0%, #fbf3e0 0%, #eeddbe 45%, #d9c199 100%)'
    : 'radial-gradient(120% 90% at 50% 0%, #3a2410 0%, #1c1006 42%, #150b04 100%)'
}

export function OpenBookSheet({
  section,
  isLight = true,
  onClose,
}: {
  section: ShelfSection
  isLight?: boolean
  onClose: () => void
}) {
  const router = useRouter()
  const th = THEMES[section.id]
  const detail = SECTION_DETAILS[section.id]
  const accent = section.accent

  return (
    <div
      className="flex min-h-[calc(100vh-8rem)] justify-center px-4 pb-16 pt-8"
      style={{ background: sceneBackground(isLight) }}
    >
      <div
        className="ss-sheet relative w-full self-start overflow-hidden rounded-2xl"
        style={{ maxWidth: 880, background: th.paper, boxShadow: '0 20px 50px rgba(0,0,0,0.35), 0 4px 12px rgba(0,0,0,0.2)' }}
      >
        {/* textura do papel-tema */}
        {th.pattern && (
          <div
            aria-hidden
            style={{ position: 'absolute', inset: 0, backgroundImage: th.pattern, backgroundSize: th.patternSize ?? 'auto', opacity: 0.9, pointerEvents: 'none' }}
          />
        )}

        {/* filete de destaque com flash da cor accent */}
        <div style={{ position: 'relative', height: 4, background: th.edge }}>
          <div className="ss-accent-flash" style={{ position: 'absolute', inset: 0, background: accent }} />
        </div>

        {/* header da folha */}
        <div
          className="relative flex flex-wrap items-center gap-3"
          style={{ zIndex: 2, padding: '16px 24px', borderBottom: `1px solid ${th.edge}22` }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '7px 14px',
              background: 'rgba(139,104,32,0.08)',
              color: '#8b6820',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              border: '1px solid rgba(139,104,32,0.2)',
              cursor: 'pointer',
            }}
          >
            ← Voltar à estante
          </button>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'rgba(0,0,0,0.78)', fontFamily: th.headFont }}>
            {section.name}
          </span>
          {th.masthead && (
            <span style={{ fontFamily: th.headFont, fontSize: 11, letterSpacing: '0.22em', color: th.edge, opacity: 0.65, textTransform: 'uppercase', fontWeight: 700 }}>
              {th.masthead}
            </span>
          )}
          <span
            className="ml-auto font-mono"
            style={{ fontSize: 10.5, fontWeight: 600, color: '#8b6820', background: 'rgba(139,104,32,0.1)', border: '1px solid rgba(139,104,32,0.2)', borderRadius: 12, padding: '3px 9px' }}
          >
            {section.route}
          </span>
        </div>

        {/* corpo da folha */}
        <div className="relative" style={{ zIndex: 2, padding: '22px 26px 30px' }}>
          <p style={{ fontSize: 15, lineHeight: 1.65, color: 'rgba(0,0,0,0.72)', maxWidth: '60ch', margin: '0 0 22px' }}>
            {detail.intro}
          </p>

          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(0,0,0,0.4)', margin: '0 0 12px' }}>
            O que você faz aqui
          </p>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 10 }}>
            {detail.does.map((item) => (
              <li key={item} style={{ display: 'flex', gap: 10, fontSize: 14, color: 'rgba(0,0,0,0.8)' }}>
                <span aria-hidden style={{ marginTop: 6, height: 7, width: 7, flex: 'none', borderRadius: 2, background: th.edge }} />
                {item}
              </li>
            ))}
          </ul>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => router.push(section.route)}
              style={{
                padding: '11px 22px',
                borderRadius: 999,
                border: 'none',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 700,
                color: '#fff',
                // Começa pela cor escura (edge) para o texto branco ficar sempre legível,
                // mesmo quando o accent da capa é claro (dourado da Agenda, coral do Desempenho).
                background: `linear-gradient(135deg, ${th.edge}, ${accent})`,
                boxShadow: '0 6px 16px rgba(0,0,0,0.22)',
              }}
            >
              {detail.cta} →
            </button>
            <span style={{ fontSize: 12.5, fontStyle: 'italic', color: 'rgba(0,0,0,0.45)' }}>
              tudo que já funciona hoje continua na tela completa
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
