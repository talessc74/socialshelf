import type { ShelfSection, ShelfSectionId } from '../../lib/shelfSections'

/**
 * Arte de capa de cada livro da prateleira (desktop) — portada 1:1 do protótipo
 * oficial (design_handoff/desktop). Cada SVG é desenhado com margens/tamanhos
 * pensados para o trapézio do clip-path (base cheia, topo afinado ~6,5%), então
 * a arte "inclina junto" com o livro sem ser cortada nos cantos.
 *
 * O <svg> preenche 100% do container e mantém a proporção (sem
 * preserveAspectRatio="none"): o viewBox tem exatamente width×182, igual ao
 * container, então enche sem distorcer.
 */

const SERIF = 'Georgia, "Times New Roman", serif'
const SANS = 'Arial, Helvetica, sans-serif'
const BLACK = '"Arial Black", Arial, sans-serif'

function Svg({ w, children }: { w: number; children: React.ReactNode }) {
  return (
    <svg viewBox={`0 0 ${w} 182`} xmlns="http://www.w3.org/2000/svg" style={{ display: 'block', width: '100%', height: '100%' }}>
      {children}
    </svg>
  )
}

function CoverArt({ id }: { id: ShelfSectionId }) {
  switch (id) {
    case 'agenda':
      return (
        <Svg w={112}>
          <defs>
            <pattern id="diagAg" patternUnits="userSpaceOnUse" width={22} height={22}>
              <path d="M0 22 L22 0" stroke="rgba(255,255,255,0.025)" strokeWidth={1} />
            </pattern>
          </defs>
          <rect width={112} height={182} fill="#1b2840" />
          <rect x={8} y={0} width={8} height={182} fill="#7a1820" />
          <rect x={6} y={160} width={12} height={22} fill="#5a0f14" rx={1} />
          <line x1={20} y1={38} x2={105} y2={38} stroke="#c9a84c" strokeWidth={0.6} opacity={0.55} />
          <polygon points="56,16 64,24 56,32 48,24" fill="#c9a84c" />
          <text x={58} y={96} fontFamily={SERIF} fontSize={15} fill="#c9a84c" textAnchor="middle" letterSpacing={5}>AGENDA</text>
          <text x={58} y={113} fontFamily={SERIF} fontSize={9} fill="#c9a84c" textAnchor="middle" letterSpacing={3} opacity={0.6}>2026</text>
          <line x1={26} y1={148} x2={86} y2={148} stroke="#c9a84c" strokeWidth={0.55} opacity={0.55} />
          <line x1={34} y1={154} x2={78} y2={154} stroke="#c9a84c" strokeWidth={0.3} opacity={0.3} />
          <rect x={0} y={0} width={112} height={182} fill="url(#diagAg)" opacity={0.6} />
        </Svg>
      )
    case 'noticias':
      return (
        <Svg w={124}>
          <rect width={124} height={182} fill="#f0e6cc" />
          <rect x={0} y={0} width={124} height={6} fill="#1a1a1a" />
          <text x={62} y={21} fontFamily={SERIF} fontSize={7.5} fill="#1a1a1a" textAnchor="middle" letterSpacing={1.8}>THE SHELF GAZETTE</text>
          <line x1={8} y1={26} x2={116} y2={26} stroke="#1a1a1a" strokeWidth={0.9} />
          <line x1={8} y1={28.5} x2={116} y2={28.5} stroke="#1a1a1a" strokeWidth={0.3} />
          <text x={12} y={50} fontFamily={SERIF} fontSize={13} fill="#1a1a1a" fontWeight="bold">Posts em alta</text>
          <text x={12} y={65} fontFamily={SERIF} fontSize={13} fill="#1a1a1a" fontWeight="bold">esta semana</text>
          {[72, 78, 84, 90].map((y, i) => (
            <rect key={`r${i}`} x={12} y={y} width={[96, 76, 88, 58][i]} height={3} fill="#1a1a1a" rx={1} opacity={0.28} />
          ))}
          <line x1={64} y1={100} x2={64} y2={152} stroke="#1a1a1a" strokeWidth={0.5} opacity={0.22} />
          {[100, 106, 112, 118, 124, 130].map((y, i) => (
            <g key={`c${i}`}>
              <rect x={12} y={y} width={[44, 38, 44, 40, 42, 36][i]} height={2} fill="#1a1a1a" rx={1} opacity={0.18} />
              <rect x={70} y={y} width={[44, 40, 42, 36, 44, 38][i]} height={2} fill="#1a1a1a" rx={1} opacity={0.18} />
            </g>
          ))}
          <line x1={8} y1={156} x2={116} y2={156} stroke="#1a1a1a" strokeWidth={0.8} />
          <text x={62} y={169} fontFamily={SERIF} fontSize={8} fill="#1a1a1a" textAnchor="middle" opacity={0.5}>Vol. I · 2026</text>
          <rect x={0} y={175} width={124} height={7} fill="#1a1a1a" />
        </Svg>
      )
    case 'desempenho': {
      const bars: Array<[number, number, number, number]> = [
        [15, 108, 12, 24], [30, 92, 12, 40], [45, 74, 12, 58], [60, 54, 12, 78], [75, 32, 12, 100],
      ]
      return (
        <Svg w={113}>
          <defs>
            <pattern id="gridDes" patternUnits="userSpaceOnUse" width={22} height={22}>
              <path d="M22 0 L0 0 0 22" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={0.5} />
            </pattern>
          </defs>
          <rect width={113} height={182} fill="#0c1d3a" />
          <rect width={113} height={182} fill="url(#gridDes)" />
          {bars.map(([x, y, w, bh], i) => (
            <rect key={`b${i}`} x={x} y={y} width={w} height={bh} fill="#e07850" rx={1.5} />
          ))}
          {bars.map(([x, y, w], i) => (
            <circle key={`d${i}`} cx={x + w / 2} cy={y} r={2.5} fill="#f0a888" />
          ))}
          <polyline points={bars.map(([x, y, w]) => `${x + w / 2},${y}`).join(' ')} fill="none" stroke="#f0a888" strokeWidth={1.2} strokeDasharray="3,2" opacity={0.6} />
          <line x1={12} y1={134} x2={100} y2={134} stroke="#e07850" strokeWidth={0.8} opacity={0.4} />
          <text x={56} y={150} fontFamily={SANS} fontSize={8} fill="#fff" textAnchor="middle" fontWeight="bold" letterSpacing={2.8}>DESEMPENHO</text>
          <text x={56} y={163} fontFamily={SANS} fontSize={6.5} fill="#e07850" textAnchor="middle" letterSpacing={1.2}>Analytics &amp; Reports</text>
        </Svg>
      )
    }
    case 'criar':
      return (
        <Svg w={124}>
          <rect width={124} height={182} fill="#f8f5ee" />
          <rect x={1} y={1} width={122} height={180} fill="none" stroke="#1a1a1a" strokeWidth={0.7} />
          <circle cx={40} cy={72} r={27} fill="#2048c0" />
          <rect x={76} y={42} width={34} height={42} fill="#c02828" />
          <polygon points="62,128 94,168 30,168" fill="#e8c000" />
          <text x={62} y={32} fontFamily={BLACK} fontSize={16} fill="#1a1a1a" textAnchor="middle" fontWeight={900} letterSpacing={2}>CRIAR</text>
          <text x={62} y={178} fontFamily={SANS} fontSize={5.5} fill="#1a1a1a" textAnchor="middle" letterSpacing={2.8} opacity={0.5}>CONTENT STUDIO</text>
        </Svg>
      )
    case 'campanhas': {
      const figs: Array<[number, number]> = [
        [22, 95], [29, 89], [35, 97], [43, 85], [50, 93], [58, 83], [65, 91], [73, 81], [81, 89], [89, 79], [96, 87],
      ]
      return (
        <Svg w={120}>
          <defs>
            <linearGradient id="skyCamp" x1={0} y1={0} x2={0} y2={1}>
              <stop offset="0%" stopColor="#dcdcd6" />
              <stop offset="52%" stopColor="#8f8f8a" />
              <stop offset="100%" stopColor="#33332f" />
            </linearGradient>
            <pattern id="grainCamp" patternUnits="userSpaceOnUse" width={3} height={3}>
              <circle cx={1} cy={1} r={0.35} fill="rgba(255,255,255,0.05)" />
              <circle cx={2.4} cy={2.2} r={0.3} fill="rgba(0,0,0,0.08)" />
            </pattern>
          </defs>
          <rect width={120} height={182} fill="#0c0c0c" />
          <rect x={8} y={12} width={104} height={118} fill="#f2efe8" />
          <rect x={11} y={15} width={98} height={112} fill="url(#skyCamp)" />
          <polygon points="11,86 40,66 68,80 90,60 109,74 109,127 11,127" fill="#565651" />
          <polygon points="11,101 45,84 80,103 109,88 109,127 11,127" fill="#1c1c1a" />
          {figs.map(([x, y], i) => (
            <rect key={`f${i}`} x={x} y={y} width={2} height={6.5} rx={0.8} fill="#080808" />
          ))}
          <rect x={11} y={15} width={98} height={112} fill="url(#grainCamp)" />
          <rect x={11} y={15} width={98} height={112} fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth={0.5} />
          <text x={60} y={150} fontFamily={SERIF} fontSize={12} fill="#f2efe8" textAnchor="middle" letterSpacing={2.4}>CAMPANHAS</text>
          <line x1={38} y1={157} x2={82} y2={157} stroke="#8a857a" strokeWidth={0.5} />
          <text x={60} y={169} fontFamily={SERIF} fontSize={6} fill="#a49e91" textAnchor="middle" letterSpacing={2.2} fontStyle="italic">Ensaios fotográficos</text>
        </Svg>
      )
    }
    case 'marca':
      return (
        <Svg w={110}>
          <rect width={110} height={182} fill="#ffffff" />
          <rect x={0.5} y={0.5} width={109} height={181} fill="none" stroke="#d8d8d8" strokeWidth={0.5} />
          <rect x={17} y={34} width={20} height={20} fill="#1a1a1a" />
          <circle cx={55} cy={44} r={10} fill="#1a1a1a" />
          <rect x={73} y={34} width={20} height={20} fill="none" stroke="#1a1a1a" strokeWidth={2} />
          <circle cx={27} cy={76} r={10} fill="none" stroke="#1a1a1a" strokeWidth={2} />
          <rect x={45} y={66} width={20} height={20} fill="#1a1a1a" />
          <circle cx={83} cy={76} r={10} fill="#1a1a1a" />
          <line x1={14} y1={104} x2={96} y2={104} stroke="#1a1a1a" strokeWidth={0.8} />
          <text x={55} y={126} fontFamily={SANS} fontSize={12} fill="#1a1a1a" textAnchor="middle" fontWeight={700} letterSpacing={5.5}>MARCA</text>
        </Svg>
      )
    case 'redes':
      return (
        <Svg w={130}>
          <rect x={0} y={0} width={65} height={91} fill="#0b1e3a" />
          <rect x={65} y={0} width={65} height={91} fill="#100830" />
          <rect x={0} y={91} width={65} height={91} fill="#080808" />
          <rect x={65} y={91} width={65} height={91} fill="#5a0c6a" />
          <line x1={65} y1={0} x2={65} y2={182} stroke="rgba(255,255,255,0.1)" strokeWidth={1} />
          <line x1={0} y1={91} x2={130} y2={91} stroke="rgba(255,255,255,0.1)" strokeWidth={1} />
          <text x={32} y={63} fontFamily={BLACK} fontSize={36} fill="#0a85c4" textAnchor="middle" fontWeight={900}>in</text>
          <rect x={78} y={22} width={36} height={36} rx={8} fill="none" stroke="#e0e0e0" strokeWidth={2} />
          <circle cx={96} cy={40} r={10} fill="none" stroke="#e0e0e0" strokeWidth={2} />
          <circle cx={108} cy={28} r={2.8} fill="#e0e0e0" />
          <text x={32} y={150} fontFamily={BLACK} fontSize={32} fill="#ffffff" textAnchor="middle" fontWeight={900}>X</text>
          <rect x={74} y={103} width={44} height={44} rx={5} fill="#1877f2" />
          <text x={96} y={142} fontFamily={BLACK} fontSize={30} fill="#ffffff" textAnchor="middle" fontWeight={900}>f</text>
          <text x={65} y={176} fontFamily={SANS} fontSize={7.5} fill="rgba(255,255,255,0.4)" textAnchor="middle" fontWeight={700} letterSpacing={4}>REDES</text>
        </Svg>
      )
  }
}

export function BookCover({ section, isLight = true }: { section: ShelfSection; isLight?: boolean }) {
  // Perspectiva de "livro encostado pra trás na parede": base reta e 100% da
  // largura (livros nunca se tocam), só o topo afina ~6,5% de cada lado. A arte
  // é desenhada para essa forma, então inclina junto sem ser cortada. As camadas
  // abaixo (lombada, sombras internas, brilho, bloco de páginas, sombra de
  // contato) são portadas do protótipo — são elas que fazem parecer um livro, e
  // não um cartaz.
  const inset = section.width * 0.065
  const clip = `polygon(${inset}px 0, ${section.width - inset}px 0, ${section.width}px 100%, 0 100%)`

  const bodyShadow = isLight
    ? 'inset -6px 0 10px -4px rgba(0,0,0,0.32), inset 4px 0 6px -2px rgba(255,255,255,0.35), inset 0 3px 5px rgba(0,0,0,0.18)'
    : 'inset -6px 0 12px -4px rgba(0,0,0,0.55), inset 4px 0 6px -2px rgba(255,255,255,0.1), inset 0 3px 6px rgba(0,0,0,0.35)'
  const bodyFilter = isLight
    ? 'drop-shadow(0 14px 16px rgba(55,45,25,0.38)) drop-shadow(0 3px 5px rgba(55,45,25,0.22))'
    : 'drop-shadow(0 14px 18px rgba(0,0,0,0.6)) drop-shadow(0 4px 8px rgba(0,0,0,0.5))'
  // Topo escurece (recua para a sombra da parede), base clareia (mais perto da luz).
  const gloss = isLight
    ? 'linear-gradient(180deg, rgba(0,0,0,0.2) 0%, transparent 20%, rgba(255,255,255,0.05) 85%, rgba(255,255,255,0.1) 100%)'
    : 'linear-gradient(180deg, rgba(0,0,0,0.4) 0%, transparent 24%, rgba(255,220,150,0.1) 88%, rgba(255,225,160,0.18) 100%)'

  return (
    <div style={{ position: 'relative' }}>
      <div
        style={{
          width: section.width,
          height: 182,
          position: 'relative',
          clipPath: clip,
          WebkitClipPath: clip,
          borderLeft: '5px solid rgba(0,0,0,0.32)', // lombada
          boxShadow: bodyShadow,
          filter: bodyFilter,
        }}
      >
        <CoverArt id={section.id} />
        {/* brilho/sombreamento que dá o volume e o recuo pra parede */}
        <div style={{ position: 'absolute', inset: 0, background: gloss, pointerEvents: 'none' }} />
        {/* bloco de páginas na borda direita (folhas creme empilhadas) */}
        <div
          style={{
            position: 'absolute',
            top: '3%',
            bottom: 0,
            right: 0,
            width: 5,
            background: 'repeating-linear-gradient(180deg, #f4ecd6 0px, #f4ecd6 2px, #d8cbaa 2px, #d8cbaa 3px)',
            boxShadow: 'inset 1px 0 2px rgba(0,0,0,0.25)',
          }}
        />
      </div>
      {/* sombra de contato colada na base — o livro assenta na prateleira */}
      <div
        style={{
          position: 'absolute',
          bottom: -4,
          left: '50%',
          transform: 'translateX(-50%)',
          width: Math.round(section.width * 0.98),
          height: 9,
          borderRadius: '50%',
          background: `radial-gradient(ellipse at center, rgba(40,30,15,${isLight ? 0.5 : 0.85}) 0%, transparent 72%)`,
          filter: 'blur(2.5px)',
          pointerEvents: 'none',
        }}
      />
    </div>
  )
}
