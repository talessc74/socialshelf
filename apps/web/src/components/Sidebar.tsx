'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Tag, BarChart3, Sparkles, Send, LogOut, Lightbulb } from 'lucide-react'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Início', icon: Home },
  { href: '/dashboard/generate', label: 'Gerar com IA', icon: Sparkles },
  { href: '/dashboard/compose', label: 'Novo Post', icon: Send },
  { href: '/dashboard/insights', label: 'Banco de Insights', icon: Lightbulb },
  { href: '/dashboard/performance', label: 'Performance', icon: BarChart3 },
  { href: '/dashboard/brand', label: 'Marca', icon: Tag },
]

interface SidebarProps {
  onLogout: () => void
}

export function Sidebar({ onLogout }: SidebarProps) {
  const pathname = usePathname()

  return (
    <aside className="flex h-screen w-16 shrink-0 flex-col items-center border-r border-gray-200 bg-white py-4">
      <Link
        href="/dashboard"
        className="mb-6 flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-sm font-bold text-white"
      >
        S
      </Link>

      <nav className="flex flex-1 flex-col items-center gap-2">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = href === '/dashboard' ? pathname === href : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              title={label}
              className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
                isActive
                  ? 'bg-brand-50 text-brand-600'
                  : 'text-gray-400 hover:bg-gray-50 hover:text-brand-600'
              }`}
            >
              <Icon className="h-5 w-5" />
            </Link>
          )
        })}
      </nav>

      <button
        onClick={onLogout}
        title="Sair"
        className="flex h-10 w-10 items-center justify-center rounded-xl text-gray-400 hover:bg-red-50 hover:text-red-600"
      >
        <LogOut className="h-5 w-5" />
      </button>
    </aside>
  )
}
