'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '../../contexts/AuthContext'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [user, loading, router])

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-diagnostic-gradient">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-300 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="bg-surface-operation-dots min-h-screen">
      <nav className="border-b border-gray-200 bg-white/80 px-4 py-3 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <Link href="/dashboard" className="shrink-0 text-lg font-bold text-brand-700">
            SocialShelf
          </Link>
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <span className="hidden min-w-0 truncate text-sm text-gray-500 sm:inline">{user.email}</span>
            <button
              onClick={logout}
              className="shrink-0 text-sm text-gray-600 hover:text-red-600"
            >
              Sair
            </button>
          </div>
        </div>
      </nav>
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  )
}
