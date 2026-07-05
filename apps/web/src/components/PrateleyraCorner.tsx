'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown, LogOut } from 'lucide-react'
import type { ApiBrand } from '../lib/api'

interface PrateleyraCornerProps {
  email: string
  brands: ApiBrand[]
  activeBrandId: string | null
  onBrandChange: (brandId: string) => void
  onLogout: () => void
}

export function PrateleyraCorner({ email, brands, activeBrandId, onBrandChange, onLogout }: PrateleyraCornerProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const activeBrand = brands.find((b) => b.id === activeBrandId) ?? null

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div ref={ref} className="absolute top-4 right-4 z-30 text-right">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
        style={{
          background: 'rgba(18,9,2,0.55)',
          border: '1px solid rgba(201,168,76,0.25)',
          color: '#e8d8a0',
          backdropFilter: 'blur(6px)',
        }}
      >
        {activeBrand?.name ?? email}
        <ChevronDown className="h-3 w-3" style={{ transform: open ? 'rotate(180deg)' : undefined, transition: 'transform 0.2s' }} />
      </button>

      {open && (
        <div
          className="mt-2 w-56 rounded-xl p-2 text-left"
          style={{ background: 'rgba(18,9,2,0.92)', border: '1px solid rgba(201,168,76,0.2)', backdropFilter: 'blur(10px)' }}
        >
          {brands.length > 1 && (
            <div className="mb-2">
              <p className="px-2 pb-1 text-[10px] uppercase tracking-wide" style={{ color: 'rgba(201,168,76,0.5)' }}>
                Trocar de marca
              </p>
              {brands.map((b) => (
                <button
                  key={b.id}
                  onClick={() => {
                    onBrandChange(b.id)
                    setOpen(false)
                  }}
                  className="block w-full rounded-lg px-2 py-1.5 text-left text-xs"
                  style={{
                    color: b.id === activeBrandId ? '#e8d8a0' : 'rgba(232,216,160,0.6)',
                    background: b.id === activeBrandId ? 'rgba(201,168,76,0.12)' : 'transparent',
                  }}
                >
                  {b.name}
                </button>
              ))}
              <div className="my-1.5 border-t" style={{ borderColor: 'rgba(201,168,76,0.15)' }} />
            </div>
          )}
          <p className="truncate px-2 pb-1 text-[10px]" style={{ color: 'rgba(232,216,160,0.4)' }}>
            {email}
          </p>
          <button
            onClick={onLogout}
            className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-xs"
            style={{ color: '#e8d8a0' }}
          >
            <LogOut className="h-3.5 w-3.5" /> Sair
          </button>
        </div>
      )}
    </div>
  )
}
