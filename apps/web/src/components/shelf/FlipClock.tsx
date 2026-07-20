'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { SHELF_SECTIONS, type ShelfSection } from '../../lib/shelfSections'

const MONTHS_PT = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ']
const PANEL_W = 168
const PANEL_H = 150
const HALF = PANEL_H / 2

type FlipStage = 'idle' | 'p1' | 'p2'

/** Face do card (ícone + nome), centrada na altura total do painel. */
function Face({ section }: { section: ShelfSection }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2" style={{ height: PANEL_H }}>
      <span style={{ fontSize: 46, lineHeight: 1 }} aria-hidden>
        {section.icon}
      </span>
      <span
        className="font-condensed font-bold uppercase"
        style={{ fontSize: 19, letterSpacing: '0.12em', color: '#f0efe8' }}
      >
        {section.name}
      </span>
    </div>
  )
}

const halfBox: React.CSSProperties = { position: 'absolute', left: 0, width: '100%', height: HALF, overflow: 'hidden' }
const TOP_GRAD = 'linear-gradient(180deg,#242420,#191916)'
const BOT_GRAD = 'linear-gradient(180deg,#161613,#0d0d0b)'

/** Metade superior/inferior mostrando a face recortada no hinge. */
function HalfFace({ section, half, grad }: { section: ShelfSection; half: 'top' | 'bottom'; grad: string }) {
  return (
    <div style={{ height: PANEL_H, transform: half === 'bottom' ? `translateY(${-HALF}px)` : undefined }}>
      <div style={{ background: grad }}>
        <Face section={section} />
      </div>
    </div>
  )
}

function LeftDisplay({
  current,
  next,
  stage,
  onOpen,
}: {
  current: ShelfSection
  next: ShelfSection
  stage: FlipStage
  onOpen: () => void
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Abrir ${current.name}`}
      className="relative cursor-pointer p-0"
      style={{ width: PANEL_W, height: PANEL_H, borderRadius: 6, overflow: 'hidden', perspective: 620, background: '#0e0e0c' }}
    >
      {/* estáticos atrás: topo = próximo, base = atual */}
      <div style={{ ...halfBox, top: 0, zIndex: 1 }}>
        <HalfFace section={next} half="top" grad={TOP_GRAD} />
      </div>
      <div style={{ ...halfBox, bottom: 0, zIndex: 1 }}>
        <HalfFace section={current} half="bottom" grad={BOT_GRAD} />
      </div>

      {/* folhas na frente */}
      <div
        style={{
          ...halfBox,
          top: 0,
          zIndex: 3,
          transformOrigin: 'center bottom',
          transformStyle: 'preserve-3d',
          backfaceVisibility: 'hidden',
          transform: stage === 'p1' || stage === 'p2' ? 'rotateX(-90deg)' : 'rotateX(0deg)',
          transition: 'transform 250ms cubic-bezier(.45,0,.9,.45)',
        }}
      >
        <HalfFace section={current} half="top" grad={TOP_GRAD} />
      </div>
      <div
        style={{
          ...halfBox,
          bottom: 0,
          zIndex: 3,
          transformOrigin: 'center top',
          transformStyle: 'preserve-3d',
          backfaceVisibility: 'hidden',
          transform: stage === 'p2' ? 'rotateX(0deg)' : 'rotateX(90deg)',
          transition: stage === 'p2' ? 'transform 300ms cubic-bezier(.28,.86,.36,1.06)' : 'none',
        }}
      >
        <HalfFace section={next} half="bottom" grad={BOT_GRAD} />
      </div>

      {/* hinge + pinos */}
      <div style={{ position: 'absolute', top: HALF - 1.5, left: 0, width: '100%', height: 3, zIndex: 4, background: 'linear-gradient(180deg,rgba(0,0,0,.55),rgba(0,0,0,.25))' }} />
      {[6, PANEL_W - 12].map((x) => (
        <div key={x} style={{ position: 'absolute', top: HALF - 4, left: x, width: 6, height: 8, zIndex: 5, borderRadius: 2, background: 'linear-gradient(180deg,#3a3d28,#22241a)' }} />
      ))}
    </button>
  )
}

function DateDisplay() {
  const [now] = useState(() => new Date())
  const day = String(now.getDate()).padStart(2, '0')
  return (
    <div className="relative flex-1" style={{ borderRadius: 6, overflow: 'hidden', background: '#0e0e0c', minHeight: PANEL_H }}>
      <div className="flex h-full flex-col items-center justify-center gap-1" style={{ background: 'linear-gradient(180deg,#201f1b,#0d0d0b)', height: PANEL_H }}>
        <span className="font-condensed font-bold" style={{ fontSize: 72, lineHeight: 1, color: '#f4f3ec' }}>
          {day}
        </span>
        <span className="font-condensed" style={{ fontSize: 11, letterSpacing: '0.28em', color: 'rgba(240,239,232,0.5)' }}>
          {MONTHS_PT[now.getMonth()]}
        </span>
      </div>
      <div style={{ position: 'absolute', top: HALF - 1.5, left: 0, width: '100%', height: 3, background: 'linear-gradient(180deg,rgba(0,0,0,.55),rgba(0,0,0,.25))' }} />
    </div>
  )
}

/**
 * Flip clock verde-oliva — a nova entrada da /dashboard no mobile. Visor
 * esquerdo (cards de seção com split-flap) + visor direito (data). Crown
 * navega; tocar no visor esquerdo abre a rota real. Sem tema claro/escuro
 * (fora de escopo, ver _local-bdr-policy-010).
 */
export function FlipClock() {
  const router = useRouter()
  const n = SHELF_SECTIONS.length
  const [currentIdx, setCurrentIdx] = useState(0)
  const [nextIdx, setNextIdx] = useState(0)
  const [stage, setStage] = useState<FlipStage>('idle')
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const dragRef = useRef<number | null>(null)

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const flipTo = useCallback(
    (target: number) => {
      if (stage !== 'idle' || target === currentIdx) return
      setNextIdx(target)
      setStage('p1')
      timers.current.push(setTimeout(() => setStage('p2'), 250))
      timers.current.push(
        setTimeout(() => {
          setCurrentIdx(target)
          setStage('idle')
        }, 250 + 300),
      )
    },
    [stage, currentIdx],
  )

  const goNext = useCallback(() => flipTo((currentIdx + 1) % n), [flipTo, currentIdx, n])
  const goPrev = useCallback(() => flipTo((currentIdx - 1 + n) % n), [flipTo, currentIdx, n])

  const current = SHELF_SECTIONS[currentIdx]!
  const next = SHELF_SECTIONS[stage === 'idle' ? currentIdx : nextIdx]!
  const openCurrent = () => router.push(current.route)

  // Crown: arrastar ↑ = anterior, ↓ = próximo (também responde a clique e setas).
  const onPointerDown = (e: React.PointerEvent) => {
    dragRef.current = e.clientY
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (dragRef.current === null) return
    const dy = e.clientY - dragRef.current
    if (dy < -26) {
      goPrev()
      dragRef.current = e.clientY
    } else if (dy > 26) {
      goNext()
      dragRef.current = e.clientY
    }
  }
  const onPointerUp = () => {
    dragRef.current = null
  }

  return (
    <div className="flex flex-col items-center gap-6 px-4 pb-10 pt-8" style={{ background: 'radial-gradient(120% 80% at 50% 8%, #f4d7a8 0%, #e9bd84 38%, #d29f66 60%, #a9773f 100%)', borderRadius: 24, minHeight: 'calc(100vh - 8rem)' }}>
      <div className="text-center">
        <p className="font-condensed font-semibold uppercase" style={{ fontSize: 12, letterSpacing: '0.28em', color: '#7a5a2a' }}>
          Sua prateleira
        </p>
        <p className="font-condensed font-extrabold" style={{ fontSize: 30, color: '#3f4328', lineHeight: 1.1 }}>
          Social<span style={{ color: '#7a5a2a' }}>Shelf</span>
        </p>
      </div>

      {/* dispositivo */}
      <div className="relative" style={{ filter: 'drop-shadow(0 24px 30px rgba(60,35,10,.45))' }}>
        <div
          className="flex flex-col gap-3"
          style={{
            borderRadius: 26,
            padding: '20px 18px 16px',
            background: 'linear-gradient(158deg, #8f9563 0%, #767a4c 42%, #5f6440 78%, #565a38 100%)',
            boxShadow: 'inset 0 2px 3px rgba(255,255,235,.35), inset 0 -4px 10px rgba(30,32,16,.45)',
          }}
        >
          <div className="flex gap-3">
            <div style={{ background: 'linear-gradient(160deg,#3a3e24,#2c2f1c)', borderRadius: 12, padding: 8, boxShadow: 'inset 0 3px 8px rgba(0,0,0,.65)' }}>
              <LeftDisplay current={current} next={next} stage={stage} onOpen={openCurrent} />
            </div>
            <div className="flex flex-1" style={{ background: 'linear-gradient(160deg,#3a3e24,#2c2f1c)', borderRadius: 12, padding: 8, boxShadow: 'inset 0 3px 8px rgba(0,0,0,.65)' }}>
              <DateDisplay />
            </div>
          </div>

          {/* faixa LCD (clima estático) */}
          <div className="self-center" style={{ padding: '3px 10px', borderRadius: 5, background: 'linear-gradient(180deg,#cfd3c4,#b7bba9)', border: '1px solid #9aa088' }}>
            <span className="font-condensed font-bold" style={{ fontSize: 13, color: '#2e3220' }}>
              24°C ⛅
            </span>
          </div>
        </div>

        {/* crown */}
        <button
          type="button"
          onClick={goNext}
          onKeyDown={(e) => {
            if (e.key === 'ArrowUp') { e.preventDefault(); goPrev() }
            if (e.key === 'ArrowDown') { e.preventDefault(); goNext() }
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          aria-label="Girar para a próxima seção"
          className="absolute touch-none"
          style={{
            right: -16,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 40,
            height: 70,
            borderRadius: 10,
            border: '1px solid #3a3d28',
            background: 'repeating-linear-gradient(180deg, #5a5e42 0 2px, #45482f 3px 4px)',
            boxShadow: '0 4px 10px rgba(0,0,0,.5), inset 0 2px 2px rgba(255,255,220,.18), inset 0 -3px 5px rgba(0,0,0,.4)',
          }}
        >
          <span style={{ display: 'block', width: 4, height: 40, margin: '0 auto', borderRadius: 2, background: 'rgba(0,0,0,0.35)' }} />
        </button>
      </div>

      {/* dots + microcopy + botão abrir */}
      <div className="flex flex-col items-center gap-4">
        <div className="flex gap-2">
          {SHELF_SECTIONS.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => flipTo(i)}
              aria-label={`Ir para ${s.name}`}
              className="h-2 w-2 rounded-full"
              style={{ background: i === currentIdx ? '#3f4328' : 'rgba(63,67,40,0.3)' }}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={openCurrent}
          className="font-condensed font-bold uppercase"
          style={{ padding: '10px 22px', borderRadius: 999, background: '#2c2f1c', color: '#f0efe8', letterSpacing: '0.08em', fontSize: 14 }}
        >
          Abrir {current.name} →
        </button>
      </div>
    </div>
  )
}
