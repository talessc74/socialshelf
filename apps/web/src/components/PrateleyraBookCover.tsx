'use client'

import { Book } from './Prateleira'

interface PrateleyraBookCoverProps {
  book: Book
}

export function PrateleyraBookCover({ book }: PrateleyraBookCoverProps) {
  const renderCover = () => {
    switch (book.id) {
      case 'agenda':
        return (
          <svg viewBox="0 0 112 182" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
            <rect width="112" height="182" fill="#1b2840" />
            <rect x="5" y="20" width="8" height="130" fill="#7a1820" />
            <polygon points="56,30 62,45 50,45" fill="#c9a84c" />
            <polygon points="56,50 65,70 47,70" fill="#c9a84c" />
            <text x="56" y="100" textAnchor="middle" fontSize="10" fontFamily="Georgia" fill="#c9a84c" fontWeight="bold">
              AGENDA
            </text>
            <text x="56" y="120" textAnchor="middle" fontSize="8" fontFamily="Georgia" fill="#c9a84c" opacity="0.7">
              2026
            </text>
          </svg>
        )
      case 'noticias':
        return (
          <svg viewBox="0 0 124 182" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
            <rect width="124" height="182" fill="#f0e6cc" />
            <text x="62" y="25" textAnchor="middle" fontSize="8" fontFamily="Georgia" fill="#1a1a1a" fontWeight="bold">
              THE SHELF GAZETTE
            </text>
            <line x1="10" y1="35" x2="114" y2="35" stroke="#1a1a1a" strokeWidth="1" />
            <text x="62" y="55" textAnchor="middle" fontSize="9" fontFamily="Georgia" fill="#1a1a1a" fontWeight="bold">
              Posts em alta
            </text>
            <text x="62" y="70" textAnchor="middle" fontSize="7" fontFamily="Georgia" fill="#1a1a1a">
              esta semana
            </text>
            <line x1="20" y1="80" x2="50" y2="80" stroke="#1a1a1a" strokeWidth="0.5" opacity="0.5" />
            <line x1="58" y1="80" x2="104" y2="80" stroke="#1a1a1a" strokeWidth="0.5" opacity="0.5" />
            <line x1="20" y1="100" x2="50" y2="100" stroke="#1a1a1a" strokeWidth="0.5" opacity="0.5" />
            <line x1="58" y1="100" x2="104" y2="100" stroke="#1a1a1a" strokeWidth="0.5" opacity="0.5" />
            <line x1="20" y1="120" x2="104" y2="120" stroke="#1a1a1a" strokeWidth="0.5" opacity="0.5" />
          </svg>
        )
      case 'desempenho':
        return (
          <svg viewBox="0 0 113 182" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
            <rect width="113" height="182" fill="#0c1d3a" />
            <g opacity="0.15">
              <line x1="15" y1="30" x2="15" y2="140" stroke="#e07850" strokeWidth="1" />
              <line x1="25" y1="30" x2="25" y2="140" stroke="#e07850" strokeWidth="1" />
              <line x1="35" y1="30" x2="35" y2="140" stroke="#e07850" strokeWidth="1" />
              <line x1="45" y1="30" x2="45" y2="140" stroke="#e07850" strokeWidth="1" />
              <line x1="55" y1="30" x2="55" y2="140" stroke="#e07850" strokeWidth="1" />
              <line x1="65" y1="30" x2="65" y2="140" stroke="#e07850" strokeWidth="1" />
              <line x1="75" y1="30" x2="75" y2="140" stroke="#e07850" strokeWidth="1" />
              <line x1="85" y1="30" x2="85" y2="140" stroke="#e07850" strokeWidth="1" />
              <line x1="95" y1="30" x2="95" y2="140" stroke="#e07850" strokeWidth="1" />
              <line x1="10" y1="50" x2="100" y2="50" stroke="#e07850" strokeWidth="1" />
              <line x1="10" y1="70" x2="100" y2="70" stroke="#e07850" strokeWidth="1" />
              <line x1="10" y1="90" x2="100" y2="90" stroke="#e07850" strokeWidth="1" />
              <line x1="10" y1="110" x2="100" y2="110" stroke="#e07850" strokeWidth="1" />
            </g>
            <rect x="20" y="110" width="6" height="30" fill="#e07850" />
            <rect x="28" y="95" width="6" height="45" fill="#e07850" />
            <rect x="36" y="80" width="6" height="60" fill="#e07850" />
            <rect x="44" y="55" width="6" height="85" fill="#e07850" />
            <rect x="52" y="40" width="6" height="100" fill="#e07850" />
            <line x1="20" y1="110" x2="58" y2="40" stroke="#e07850" strokeWidth="1.5" />
            <text x="56" y="160" textAnchor="middle" fontSize="7" fontFamily="sans-serif" fill="#e07850">
              DESEMPENHO
            </text>
          </svg>
        )
      case 'criar':
        return (
          <svg viewBox="0 0 124 182" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
            <rect width="124" height="182" fill="#f8f5ee" />
            <rect x="1" y="1" width="122" height="180" fill="none" stroke="#000" strokeWidth="1" />
            <circle cx="40" cy="60" r="20" fill="#2048c0" />
            <rect x="55" y="45" width="30" height="30" fill="#c02828" />
            <polygon points="80,90 90,110 70,110" fill="#e8c000" />
            <text x="62" y="150" textAnchor="middle" fontSize="14" fontFamily="sans-serif" fill="#000" fontWeight="bold">
              CRIAR
            </text>
          </svg>
        )
      case 'marca':
        return (
          <svg viewBox="0 0 110 182" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
            <rect width="110" height="182" fill="#ffffff" />
            <rect x="10" y="20" width="20" height="20" fill="#000" />
            <rect x="40" y="20" width="20" height="20" fill="none" stroke="#000" strokeWidth="2" />
            <rect x="70" y="20" width="20" height="20" fill="#000" />
            <circle cx="20" cy="70" r="10" fill="#000" />
            <circle cx="50" cy="70" r="10" fill="none" stroke="#000" strokeWidth="2" />
            <circle cx="80" cy="70" r="10" fill="#000" />
            <rect x="10" y="100" width="20" height="20" fill="#000" />
            <rect x="40" y="100" width="20" height="20" fill="none" stroke="#000" strokeWidth="2" />
            <rect x="70" y="100" width="20" height="20" fill="#000" />
            <line x1="15" y1="135" x2="95" y2="135" stroke="#000" strokeWidth="1" />
            <text x="55" y="160" textAnchor="middle" fontSize="12" fontFamily="sans-serif" fill="#000" fontWeight="bold">
              MARCA
            </text>
          </svg>
        )
      case 'redes':
        return (
          <svg viewBox="0 0 130 182" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
            <rect x="0" y="0" width="65" height="91" fill="#0b63b8" />
            <rect x="65" y="0" width="65" height="91" fill="#1f2937" />
            <rect x="0" y="91" width="65" height="91" fill="#f5a623" />
            <rect x="65" y="91" width="65" height="91" fill="#5a0c6a" />
            <text x="32" y="50" textAnchor="middle" fontSize="10" fontFamily="sans-serif" fill="#ffffff" fontWeight="bold">
              In
            </text>
            <text x="97" y="50" textAnchor="middle" fontSize="10" fontFamily="sans-serif" fill="#ffffff" fontWeight="bold">
              X
            </text>
            <text x="32" y="140" textAnchor="middle" fontSize="10" fontFamily="sans-serif" fill="#000" fontWeight="bold">
              Ig
            </text>
            <text x="97" y="140" textAnchor="middle" fontSize="10" fontFamily="sans-serif" fill="#ffffff" fontWeight="bold">
              f
            </text>
          </svg>
        )
    }
  }

  return (
    <div
      className="w-full h-full rounded-[2px] border-l-[5px] overflow-hidden"
      style={{
        borderLeftColor: 'rgba(0,0,0,0.35)',
        boxShadow: `
          3px 0 8px rgba(0,0,0,0.55),
          0 4px 16px rgba(0,0,0,0.45),
          inset 4px 0 10px rgba(0,0,0,0.22)
        `,
      }}
    >
      {renderCover()}
    </div>
  )
}
