'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Home, Tag, BarChart3, Sparkles, Send, LogOut, Lightbulb, Share2, Clock, Newspaper, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Início', icon: Home },
  { href: '/dashboard/news', label: 'Notícias', icon: Newspaper },
  { href: '/dashboard/generate', label: 'Gerar com IA', icon: Sparkles },
  { href: '/dashboard/compose', label: 'Novo Post', icon: Send },
  { href: '/dashboard/scheduled', label: 'Agendados', icon: Clock },
  { href: '/dashboard/insights', label: 'Insights', icon: Lightbulb },
  { href: '/dashboard/performance', label: 'Performance', icon: BarChart3 },
  { href: '/dashboard/accounts', label: 'Contas', icon: Share2 },
  { href: '/dashboard/brand', label: 'Marca', icon: Tag },
]

interface TopNavBrand {
  id: string
  name: string
}

interface TopNavProps {
  email: string
  onLogout: () => void
  brands?: TopNavBrand[]
  activeBrandId?: string | null
  onBrandChange?: (brandId: string) => void
}

export function TopNav({ email, onLogout, brands, activeBrandId, onBrandChange }: TopNavProps) {
  const pathname = usePathname()
  const mobileNavRef = useRef<HTMLElement>(null)
  const brandMenuRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const [brandMenuOpen, setBrandMenuOpen] = useState(false)

  const showBrandSwitcher = (brands?.length ?? 0) > 1
  const activeBrand = brands?.find((b) => b.id === activeBrandId) ?? null

  useEffect(() => {
    if (!brandMenuOpen) return
    function handleClickOutside(event: MouseEvent) {
      if (!brandMenuRef.current?.contains(event.target as Node)) {
        setBrandMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [brandMenuOpen])

  const updateScrollAffordance = useCallback(() => {
    const nav = mobileNavRef.current
    if (!nav) return
    setCanScrollLeft(nav.scrollLeft > 0)
    setCanScrollRight(nav.scrollLeft + nav.clientWidth < nav.scrollWidth - 1)
  }, [])

  useEffect(() => {
    mobileNavRef.current
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [pathname])

  useEffect(() => {
    updateScrollAffordance()
    window.addEventListener('resize', updateScrollAffordance)
    return () => window.removeEventListener('resize', updateScrollAffordance)
  }, [updateScrollAffordance])

  return (
    <header className="sticky top-0 z-10 flex flex-col border-b border-brand-100/60 bg-white/80 backdrop-blur">
      <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
      <Link
        href="/dashboard"
        title="Ir para o início"
        className="flex shrink-0 items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm font-bold text-gray-900 shadow-sm transition-colors hover:border-brand-300 hover:bg-brand-50"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-icon.png" alt="" className="h-7 w-7 rounded-md" />
        Social<span className="text-brand-600">Shelf</span>
      </Link>

      {showBrandSwitcher && (
        <div ref={brandMenuRef} className="relative shrink-0">
          <button
            type="button"
            onClick={() => setBrandMenuOpen((open) => !open)}
            aria-haspopup="listbox"
            aria-expanded={brandMenuOpen}
            className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:border-brand-300 hover:bg-brand-50"
          >
            <span className="max-w-[8rem] truncate sm:max-w-[12rem]">{activeBrand?.name ?? 'Marca'}</span>
            <ChevronDown className="h-4 w-4 text-gray-400" />
          </button>
          {brandMenuOpen && (
            <div
              role="listbox"
              className="absolute left-0 top-full z-20 mt-2 w-56 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-lg"
            >
              {brands?.map((brand) => (
                <button
                  key={brand.id}
                  type="button"
                  role="option"
                  aria-selected={brand.id === activeBrandId}
                  onClick={() => {
                    onBrandChange?.(brand.id)
                    setBrandMenuOpen(false)
                  }}
                  className={`flex w-full items-center px-3 py-2 text-left text-sm ${
                    brand.id === activeBrandId
                      ? 'bg-gray-100 font-medium text-gray-900'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {brand.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <nav className="hidden flex-1 items-center justify-center gap-1 rounded-full bg-gray-100 p-1 lg:flex">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = href === '/dashboard' ? pathname === href : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-gray-900 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="flex shrink-0 items-center gap-3">
        <span className="hidden truncate text-sm text-gray-500 sm:inline">{email}</span>
        <button
          onClick={onLogout}
          title="Sair"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-red-50 hover:text-red-600"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
      </div>

      <div className="relative w-full border-t border-gray-100 lg:hidden">
        <nav
          ref={mobileNavRef}
          onScroll={updateScrollAffordance}
          className="flex w-full items-center gap-1 overflow-x-auto bg-white px-3 py-2"
        >
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const isActive = href === '/dashboard' ? pathname === href : pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                data-active={isActive}
                className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium ${
                  isActive ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </Link>
            )
          })}
        </nav>
        {canScrollLeft && (
          <div className="pointer-events-none absolute inset-y-0 left-0 flex w-10 items-center justify-start bg-gradient-to-r from-white via-white/70 to-transparent">
            <ChevronLeft className="h-4 w-4 text-gray-400" />
          </div>
        )}
        {canScrollRight && (
          <div className="pointer-events-none absolute inset-y-0 right-0 flex w-10 items-center justify-end bg-gradient-to-l from-white via-white/70 to-transparent">
            <ChevronRight className="h-4 w-4 text-gray-400" />
          </div>
        )}
      </div>
    </header>
  )
}
