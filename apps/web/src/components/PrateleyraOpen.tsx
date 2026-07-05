'use client'

import { Fragment } from 'react'
import { Book } from './Prateleira'
import { RedesDesktopLeft, RedesDesktopRight, RedesMobile } from './prateleira-books/RedesBook'
import { MarcaDesktopLeft, MarcaDesktopRight, MarcaMobile, MarcaProvider } from './prateleira-books/MarcaBook'
import { NoticiasDesktopLeft, NoticiasDesktopRight, NoticiasMobile, NoticiasProvider } from './prateleira-books/NoticiasBook'

interface PrateleyraOpenProps {
  book: Book
  onClose: () => void
  isMobile: boolean
}

const BOOK_CONTENT: Partial<
  Record<Book['id'], { left: () => JSX.Element; right: () => JSX.Element; mobile: () => JSX.Element; Provider?: React.ComponentType<{ children: React.ReactNode }> }>
> = {
  redes: { left: RedesDesktopLeft, right: RedesDesktopRight, mobile: RedesMobile },
  marca: { left: MarcaDesktopLeft, right: MarcaDesktopRight, mobile: MarcaMobile, Provider: MarcaProvider },
  noticias: { left: NoticiasDesktopLeft, right: NoticiasDesktopRight, mobile: NoticiasMobile, Provider: NoticiasProvider },
}

export function PrateleyraOpen({ book, onClose, isMobile }: PrateleyraOpenProps) {
  const content = BOOK_CONTENT[book.id]
  const Wrapper = content?.Provider ?? Fragment

  if (isMobile && content) {
    return (
      <div
        className="flex items-center justify-center h-full px-4"
        style={{ opacity: 1, transition: 'opacity 0.45s ease' }}
      >
        <div
          className="w-full max-w-sm rounded-xl bg-white dark:bg-slate-900 p-4"
          style={{
            background: 'linear-gradient(to bottom, #ede4d0 0%, #fdf8f2 15%)',
            boxShadow: '0 30px 60px rgba(0,0,0,0.6)',
            maxHeight: '85vh',
            overflowY: 'auto',
          }}
        >
          <div
            className="mb-3"
            style={{ height: '3px', width: '50px', background: `linear-gradient(to right, ${book.accent}, transparent)` }}
          />
          <h2 className="text-sm font-bold mb-3" style={{ color: 'rgba(0,0,0,0.68)', letterSpacing: '-0.01em' }}>
            {book.label}
          </h2>
          <Wrapper>
            <content.mobile />
          </Wrapper>
          <button
            onClick={onClose}
            className="mt-4 w-full rounded text-xs font-bold tracking-wide py-2"
            style={{ background: `linear-gradient(135deg, ${book.accent}dd, ${book.accent})`, color: '#fff' }}
          >
            ← Fechar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="flex items-center justify-center h-full px-4"
      style={{
        perspective: '1800px',
        perspectiveOrigin: '50% -20%',
        opacity: 1,
        transition: 'opacity 0.45s ease',
      }}
    >
      <div
        className="w-full max-w-3xl"
        style={{
          transform: 'rotateX(22deg)',
          transformOrigin: 'center top',
          transformStyle: 'preserve-3d',
          animation: 'spreadReveal 0.65s cubic-bezier(0.22,1,0.36,1) both',
          boxShadow: `
            0 50px 100px rgba(0,0,0,0.75),
            0 18px 36px rgba(0,0,0,0.45)
          `,
          borderRadius: '8px',
          overflow: 'hidden',
          minHeight: '490px',
        }}
      >
        <Wrapper>
        <div className="flex gap-0 bg-white dark:bg-slate-900">
          {/* Left page */}
          <div
            className="flex-1 p-5 overflow-y-auto"
            style={{
              maxHeight: '490px',
              background: 'linear-gradient(to left, #ede4d0 0%, #fdf8f2 22%)',
              borderRadius: '8px 0 0 8px',
              boxShadow: 'inset -18px 0 28px -8px rgba(0,0,0,0.13)',
            }}
          >
            {/* Colored accent rule */}
            <div
              className="mb-4"
              style={{
                height: '3px',
                width: '50px',
                background: `linear-gradient(to right, ${book.accent}, transparent)`,
              }}
            />

            <h2
              className="text-sm font-bold mb-3"
              style={{
                color: 'rgba(0,0,0,0.68)',
                letterSpacing: '-0.01em',
              }}
            >
              {book.leftTitle}
            </h2>

            {/* Content area */}
            <div style={{ fontSize: '11px', color: 'rgba(0,0,0,0.7)', lineHeight: '1.55' }}>
              {content ? (
                <content.left />
              ) : (
                <div className="space-y-2">
                  <div className="p-2 rounded bg-white/50 dark:bg-slate-800/50">
                    <p className="font-medium">Carregando conteúdo...</p>
                    <p className="text-xs opacity-60">Os dados serão exibidos aqui</p>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div
              className="mt-auto pt-4 border-t"
              style={{
                borderColor: 'rgba(0,0,0,0.07)',
                marginTop: 'auto',
              }}
            >
              <p
                style={{
                  fontSize: '10px',
                  fontStyle: 'italic',
                  color: 'rgba(0,0,0,0.22)',
                }}
              >
                página 1
              </p>
            </div>
          </div>

          {/* Spine binding */}
          <div
            className="flex-shrink-0"
            style={{
              width: '22px',
              background: 'linear-gradient(to right, rgba(0,0,0,0.15), rgba(0,0,0,0.04) 45%, rgba(0,0,0,0.04) 55%, rgba(0,0,0,0.13))',
              borderTop: '1px solid rgba(0,0,0,0.1)',
              borderBottom: '1px solid rgba(0,0,0,0.1)',
              position: 'relative',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: '0',
                bottom: '0',
                left: '50%',
                width: '1px',
                background: 'rgba(0,0,0,0.1)',
              }}
            />
          </div>

          {/* Right page */}
          <div
            className="flex-1 p-5 overflow-y-auto flex flex-col"
            style={{
              maxHeight: '490px',
              background: 'linear-gradient(to right, #ede4d0 0%, #fdf9f2 22%)',
              borderRadius: '0 8px 8px 0',
              boxShadow: 'inset 18px 0 28px -8px rgba(0,0,0,0.08)',
            }}
          >
            {/* Colored accent rule */}
            <div
              className="mb-4"
              style={{
                height: '3px',
                width: '50px',
                background: `linear-gradient(to left, ${book.accent}, transparent)`,
                marginLeft: 'auto',
              }}
            />

            <h2
              className="text-sm font-bold mb-3"
              style={{
                color: 'rgba(0,0,0,0.68)',
                letterSpacing: '-0.01em',
              }}
            >
              {book.rightTitle}
            </h2>

            {/* Action area */}
            <div className="flex-1 flex flex-col gap-4">
              {content ? <content.right /> : null}

              <button
                onClick={onClose}
                className="px-4 py-2 rounded text-xs font-bold tracking-wide transition-all hover:opacity-90"
                style={{
                  background: `linear-gradient(135deg, ${book.accent}dd, ${book.accent})`,
                  color: '#ffffff',
                  letterSpacing: '0.03em',
                  boxShadow: `0 4px 12px ${book.accent}40`,
                }}
              >
                {book.cta}
              </button>

              <div className="flex-1" />
            </div>

            {/* Footer */}
            <div
              className="pt-4 border-t"
              style={{
                borderColor: 'rgba(0,0,0,0.07)',
              }}
            >
              <p
                style={{
                  fontSize: '10px',
                  fontStyle: 'italic',
                  color: 'rgba(0,0,0,0.22)',
                }}
              >
                página 2
              </p>
            </div>
          </div>
        </div>
        </Wrapper>
      </div>

      <style>{`
        @keyframes spreadReveal {
          from {
            transform: rotateX(48deg) scale(0.82);
            opacity: 0;
          }
          to {
            transform: rotateX(22deg) scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  )
}
