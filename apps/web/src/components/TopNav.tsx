'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Home, Tag, BarChart3, Sparkles, Send, LogOut, Lightbulb, Share2, Clock } from 'lucide-react'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Início', icon: Home },
  { href: '/dashboard/generate', label: 'Gerar com IA', icon: Sparkles },
  { href: '/dashboard/compose', label: 'Novo Post', icon: Send },
  { href: '/dashboard/scheduled', label: 'Agendados', icon: Clock },
  { href: '/dashboard/insights', label: 'Insights', icon: Lightbulb },
  { href: '/dashboard/performance', label: 'Performance', icon: BarChart3 },
  { href: '/dashboard/accounts', label: 'Contas', icon: Share2 },
  { href: '/dashboard/brand', label: 'Marca', icon: Tag },
]

interface TopNavProps {
  email: string
  onLogout: () => void
}

export function TopNav({ email, onLogout }: TopNavProps) {
  const pathname = usePathname()
  const mobileNavRef = useRef<HTMLElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

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
        className="flex shrink-0 items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-900 shadow-sm"
      >
        Social<span className="text-brand-600">Shelf</span>
      </Link>

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
          <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-white to-transparent" />
        )}
        {canScrollRight && (
          <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white to-transparent" />
        )}
      </div>
    </header>
  )
}
