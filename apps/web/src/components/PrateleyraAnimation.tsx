'use client'

import { Book } from './Prateleira'
import { PrateleyraBookCover } from './PrateleyraBookCover'

interface PrateleyraAnimationProps {
  book: Book
  coverAngle: number
  isMobile: boolean
}

export function PrateleyraAnimation({ book, coverAngle, isMobile }: PrateleyraAnimationProps) {
  return (
    <div
      className="flex items-center justify-center h-full"
      style={{
        perspective: '2300px',
        perspectiveOrigin: '50% 36%',
        opacity: 1,
        transition: 'opacity 0.45s ease',
      }}
    >
      <div
        style={{
          width: '310px',
          height: '410px',
          transformStyle: 'preserve-3d',
          position: 'relative',
          animation: 'bookFloat 3.5s ease-in-out infinite',
        }}
      >
        {/* Back cover */}
        <div
          style={{
            position: 'absolute',
            width: '310px',
            height: '410px',
            background: `linear-gradient(135deg, ${book.colorDark} 0%, ${book.colorDark}99 100%)`,
            transform: 'translateZ(-17px)',
            borderRadius: '2px 5px 5px 2px',
          }}
        />

        {/* Pages block */}
        <div
          style={{
            position: 'absolute',
            width: '310px',
            height: '410px',
            background: 'linear-gradient(to right, #fdf8f0, #ede5d5)',
            transform: 'translateZ(-15px)',
            boxShadow: `
              3px 0 0 #f5ede0,
              5px 0 0 #ede4d0,
              7px 0 0 #e5dcc8,
              9px 0 0 #ddd4c0
            `,
            borderRadius: '2px 5px 5px 2px',
          }}
        />

        {/* Spine */}
        <div
          style={{
            position: 'absolute',
            width: '17px',
            height: '410px',
            background: `linear-gradient(to right, ${book.colorDark}88, ${book.colorDark}44)`,
            transform: 'rotateY(-90deg) translateX(-8.5px)',
            transformOrigin: 'left center',
            zIndex: 1,
          }}
        />

        {/* Page fans */}
        {[
          { opacity: 0.08, delay: '0s', factor: 0.08 },
          { opacity: 0.12, delay: '0.02s', factor: 0.16 },
          { opacity: 0.16, delay: '0.04s', factor: 0.28 },
        ].map((fan, i) => (
          <div
            key={`fan-${i}`}
            style={{
              position: 'absolute',
              width: '310px',
              height: '410px',
              background: 'rgba(200, 180, 150, 0.2)',
              transform: `rotateY(${coverAngle * fan.factor}deg)`,
              transformOrigin: 'left center',
              transformStyle: 'preserve-3d',
              transition: `transform 0.88s cubic-bezier(0.645, 0.045, 0.355, 1) ${fan.delay}`,
              zIndex: 3 - i,
            }}
          />
        ))}

        {/* Front cover */}
        <div
          style={{
            position: 'absolute',
            width: '310px',
            height: '410px',
            transformStyle: 'preserve-3d',
            transform: `rotateY(${coverAngle}deg)`,
            transformOrigin: 'left center',
            transition: 'transform 0.88s cubic-bezier(0.645, 0.045, 0.355, 1)',
            zIndex: 4,
          }}
        >
          {/* Front face */}
          <div
            style={{
              position: 'absolute',
              width: '310px',
              height: '410px',
              backfaceVisibility: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div className="w-full h-full">
              <PrateleyraBookCover book={book} />
            </div>
          </div>

          {/* Back face (inside) */}
          <div
            style={{
              position: 'absolute',
              width: '310px',
              height: '410px',
              background: '#fdf8f0',
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
              borderRadius: '2px 5px 5px 2px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#1a1a1a',
              fontSize: '12px',
              textAlign: 'center',
            }}
          >
            <p style={{ opacity: 0.6 }}>Página interna</p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes bookFloat {
          0%, 100% {
            transform: rotateX(-5deg) rotateY(6deg) translateY(0);
          }
          50% {
            transform: rotateX(-5deg) rotateY(6deg) translateY(-10px);
          }
        }
      `}</style>
    </div>
  )
}
