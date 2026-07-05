'use client'

import { useEffect, useState } from 'react'
import { Book, BookId } from './Prateleira'
import { PrateleyraBookCover } from './PrateleyraBookCover'

interface PrateleyraShelfProps {
  books: Book[]
  onBookClick: (bookId: BookId) => void
  isMobile: boolean
}

export function PrateleyraShelf({ books, onBookClick, isMobile }: PrateleyraShelfProps) {
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    setIsLoaded(true)
  }, [])

  const scale = isMobile ? 0.72 : 1
  const rowGap = isMobile ? '6px' : '10px'
  const rowPadding = isMobile ? '16px' : '24px'

  return (
    <div className="flex flex-col items-center justify-center h-full px-4 py-8">
      {/* Title */}
      <div className="mb-8 text-center">
        <h1
          className={isMobile ? 'font-serif text-3xl font-normal tracking-widest text-[#c9a84c] mb-2' : 'font-serif text-5xl font-normal tracking-widest text-[#c9a84c] mb-2'}
          style={{
            animation: isLoaded ? 'fadeIn 0.8s ease-out forwards' : 'none',
            textShadow: '0 0 20px rgba(201, 168, 76, 0.3)',
          }}
        >
          SOCIALSHELF
        </h1>
        <p className="text-sm italic tracking-wider text-[rgba(201,168,76,0.5)]">
          Clique em um livro para abrir
        </p>
      </div>

      {/* Books container — em telas estreitas, rola horizontalmente com snap para caber todos os livros */}
      <div className="w-full max-w-3xl overflow-x-auto no-scrollbar" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div
          className="flex items-end mb-6 perspective snap-x snap-mandatory"
          style={{
            gap: rowGap,
            padding: `0 ${rowPadding}`,
            width: 'max-content',
            minWidth: '100%',
            justifyContent: isMobile ? 'flex-start' : 'center',
            perspective: '2300px',
            perspectiveOrigin: '50% 36%',
            animation: isLoaded ? 'fadeUp 0.55s 0.2s ease both' : 'none',
          }}
        >
          {books.map((book) => (
            <button
              key={book.id}
              onClick={() => onBookClick(book.id)}
              className="relative group flex-shrink-0 snap-center transition-transform duration-300 ease-out hover:-translate-y-5 hover:brightness-110 cursor-pointer"
              style={{
                width: `${book.width * scale}px`,
                height: `${book.height * scale}px`,
              }}
            >
              <PrateleyraBookCover book={book} />
            </button>
          ))}
        </div>
      </div>

      {/* Shelf */}
      <div
        className="relative w-full max-w-3xl mb-8"
        style={{
          height: '20px',
          background: 'linear-gradient(to bottom, #b87333, #8b5520 45%, #6b3e12)',
          borderRadius: '3px',
          boxShadow: `
            0 4px 18px rgba(0,0,0,0.65),
            inset 0 2px 3px rgba(255,200,100,0.12),
            inset 0 -1px 2px rgba(0,0,0,0.3),
            0 8px 8px rgba(0,0,0,0.4)
          `,
        }}
      />

      {/* Book labels */}
      <div className="w-full max-w-3xl overflow-x-auto no-scrollbar mb-8">
        <div className="flex items-start" style={{ gap: rowGap, padding: `0 ${rowPadding}`, width: 'max-content', minWidth: '100%', justifyContent: isMobile ? 'flex-start' : 'center' }}>
          {books.map((book) => (
            <div
              key={`label-${book.id}`}
              style={{
                width: `${book.width * scale}px`,
              }}
              className="text-center"
            >
              <p className="text-xs font-semibold tracking-widest uppercase text-[rgba(201,168,76,0.5)]">
                {book.label}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Tagline */}
      <p className="text-sm italic tracking-wider text-[rgba(201,168,76,0.3)] px-4 text-center">
        {isMobile ? '— arraste para o lado e selecione um livro —' : '— selecione um livro para abrir —'}
      </p>

      {/* Styles */}
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes fadeUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .no-scrollbar {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  )
}
