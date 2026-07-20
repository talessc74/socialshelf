import type { ShelfSection, ShelfSectionId } from '../../lib/shelfSections'

/**
 * Arte de capa de cada livro da prateleira (desktop). SVG on-spec (cores,
 * título e motivo de _local-bdr-policy-010 / handoff). As capas são
 * ilustrativas do tom — o clique leva à rota real; ver ShelfScene.
 *
 * Cada SVG usa viewBox de largura própria (a da capa) por 182 de altura e
 * preenche 100% do container.
 */

const H = 182

function Cover({ id, w }: { id: ShelfSectionId; w: number }) {
  const cx = w / 2
  const svg = { viewBox: `0 0 ${w} ${H}`, width: '100%', height: '100%', preserveAspectRatio: 'none' as const }

  switch (id) {
    case 'agenda':
      return (
        <svg {...svg}>
          <rect width={w} height={H} fill="#1b2840" />
          <rect x="0" y="0" width="13" height={H} fill="#7a1820" />
          <rect x="24" y="20" width={w - 42} height={H - 40} fill="none" stroke="#c9a84c" strokeWidth="1.4" opacity="0.55" />
          <path d={`M${cx + 6} 66 l18 18 -18 18 -18 -18 z`} fill="none" stroke="#c9a84c" strokeWidth="1.6" />
          <path d={`M${cx + 6} 74 l10 10 -10 10 -10 -10 z`} fill="#c9a84c" />
          <text x={cx + 6} y="128" textAnchor="middle" fontFamily="Georgia, serif" fontSize="17" fill="#e8d8a0" letterSpacing="1.5">AGENDA</text>
          <text x={cx + 6} y="148" textAnchor="middle" fontFamily="Georgia, serif" fontSize="11" fill="#c9a84c" opacity="0.8" letterSpacing="3">2026</text>
        </svg>
      )
    case 'noticias':
      return (
        <svg {...svg}>
          <rect width={w} height={H} fill="#f0e6cc" />
          <text x={cx} y="30" textAnchor="middle" fontFamily="Georgia, serif" fontSize="12" fill="#3d2409" letterSpacing="0.5">THE SHELF GAZETTE</text>
          <line x1="14" y1="40" x2={w - 14} y2="40" stroke="#6b4010" strokeWidth="1" />
          <line x1="14" y1="43" x2={w - 14} y2="43" stroke="#6b4010" strokeWidth="0.5" />
          <text x={cx} y="66" textAnchor="middle" fontFamily="Georgia, serif" fontSize="10" fontWeight="700" fill="#2a1c08">Posts em alta</text>
          <text x={cx} y="80" textAnchor="middle" fontFamily="Georgia, serif" fontSize="10" fontWeight="700" fill="#2a1c08">esta semana</text>
          {[96, 104, 112, 120, 128, 136, 144, 152].map((y, i) => (
            <line key={i} x1="16" y1={y} x2={w - 16} y2={y} stroke="#3d2409" strokeWidth="2.4" opacity="0.28" />
          ))}
          <line x1={cx} y1="92" x2={cx} y2="156" stroke="#3d2409" strokeWidth="0.6" opacity="0.4" />
        </svg>
      )
    case 'desempenho':
      return (
        <svg {...svg}>
          <rect width={w} height={H} fill="#0c1d3a" />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <line key={`h${i}`} x1="0" y1={30 + i * 24} x2={w} y2={30 + i * 24} stroke="#20365c" strokeWidth="0.6" />
          ))}
          {[26, 46, 66, 86].map((x, i) => {
            const bh = 30 + i * 24
            return <rect key={i} x={x} y={150 - bh} width="13" height={bh} rx="1.5" fill="#e07850" />
          })}
          <path d={`M26 120 L${w - 20} 44`} stroke="#f0a080" strokeWidth="1.6" fill="none" strokeDasharray="3 3" />
          <text x={cx} y="172" textAnchor="middle" fontFamily="var(--font-sans), sans-serif" fontSize="10" fontWeight="700" fill="#e07850" letterSpacing="1">DESEMPENHO</text>
        </svg>
      )
    case 'criar':
      return (
        <svg {...svg}>
          <rect width={w} height={H} fill="#f8f5ee" />
          <rect x="6" y="6" width={w - 12} height={H - 12} fill="none" stroke="#111" strokeWidth="1" />
          <circle cx={cx - 22} cy="64" r="20" fill="#2048c0" />
          <rect x={cx - 2} y="46" width="34" height="34" fill="#c02828" />
          <path d={`M${cx - 30} 118 l24 0 -12 -22 z`} fill="#e8c000" />
          <text x={cx} y="150" textAnchor="middle" fontFamily="var(--font-sans), sans-serif" fontSize="22" fontWeight="800" fill="#111" letterSpacing="1">CRIAR</text>
        </svg>
      )
    case 'campanhas':
      return (
        <svg {...svg}>
          <defs>
            <linearGradient id="camp-sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#dcdcd6" />
              <stop offset="1" stopColor="#33332f" />
            </linearGradient>
          </defs>
          <rect width={w} height={H} fill="#f2efe8" />
          <rect x="10" y="10" width={w - 20} height="132" fill="url(#camp-sky)" />
          <path d={`M10 108 L${cx - 10} 70 L${cx + 20} 96 L${w - 10} 66 L${w - 10} 142 L10 142 Z`} fill="#565651" />
          <path d={`M10 142 L${cx} 104 L${w - 10} 142 Z`} fill="#1c1c1a" />
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <circle key={i} cx={26 + i * ((w - 52) / 7)} cy={128 - (i % 3) * 4} r="2.1" fill="#0a0a09" />
          ))}
          <text x={cx} y="160" textAnchor="middle" fontFamily="Georgia, serif" fontSize="13" fill="#2a2a28" letterSpacing="1">CAMPANHAS</text>
          <text x={cx} y="173" textAnchor="middle" fontFamily="Georgia, serif" fontSize="8.5" fontStyle="italic" fill="#6a6a64">Ensaios fotográficos</text>
        </svg>
      )
    case 'marca':
      return (
        <svg {...svg}>
          <rect width={w} height={H} fill="#ffffff" />
          {[0, 1, 2].map((row) =>
            [0, 1].map((col) => {
              const gx = 26 + col * (w - 52)
              const gy = 40 + row * 34
              const filled = (row + col) % 2 === 0
              return (row + col) % 3 === 0 ? (
                <circle key={`${row}-${col}`} cx={gx} cy={gy} r="13" fill={filled ? '#1a1a1a' : 'none'} stroke="#1a1a1a" strokeWidth="1.4" />
              ) : (
                <rect key={`${row}-${col}`} x={gx - 13} y={gy - 13} width="26" height="26" fill={filled ? '#1a1a1a' : 'none'} stroke="#1a1a1a" strokeWidth="1.4" />
              )
            }),
          )}
          <line x1="16" y1="150" x2={w - 16} y2="150" stroke="#1a1a1a" strokeWidth="0.8" />
          <text x={cx} y="168" textAnchor="middle" fontFamily="var(--font-sans), sans-serif" fontSize="12" fontWeight="700" fill="#1a1a1a" letterSpacing="5">MARCA</text>
        </svg>
      )
    case 'redes':
      return (
        <svg {...svg}>
          <rect x="0" y="0" width={cx} height={H / 2} fill="#0077b5" />
          <rect x={cx} y="0" width={cx} height={H / 2} fill="#2b2b2b" />
          <rect x="0" y={H / 2} width={cx} height={H / 2} fill="#000000" />
          <rect x={cx} y={H / 2} width={cx} height={H / 2} fill="#5a0c6a" />
          <text x={cx / 2} y={H / 4 + 6} textAnchor="middle" fontFamily="var(--font-sans), sans-serif" fontSize="18" fontWeight="800" fill="#fff">in</text>
          <rect x={cx + cx / 2 - 12} y={H / 4 - 12} width="24" height="24" rx="7" fill="none" stroke="#fff" strokeWidth="2" />
          <circle cx={cx + cx / 2} cy={H / 4} r="5" fill="none" stroke="#fff" strokeWidth="2" />
          <text x={cx / 2} y={(3 * H) / 4 + 7} textAnchor="middle" fontFamily="var(--font-sans), sans-serif" fontSize="18" fontWeight="800" fill="#fff">X</text>
          <text x={cx + cx / 2} y={(3 * H) / 4 + 8} textAnchor="middle" fontFamily="Georgia, serif" fontSize="20" fontWeight="800" fill="#fff">f</text>
        </svg>
      )
  }
}

export function BookCover({ section }: { section: ShelfSection }) {
  return (
    <div
      className="overflow-hidden"
      style={{
        width: section.width,
        height: H,
        borderRadius: '2px 5px 5px 2px',
        borderLeft: '5px solid rgba(0,0,0,0.35)',
        boxShadow:
          '3px 0 8px rgba(0,0,0,0.55), 0 4px 16px rgba(0,0,0,0.45), inset 4px 0 10px rgba(0,0,0,0.22)',
      }}
    >
      <Cover id={section.id} w={section.width} />
    </div>
  )
}
