'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../contexts/AuthContext'
import { Sidebar } from '../../components/Sidebar'

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
    <div className="flex bg-surface-operation-dots">
      <Sidebar onLogout={logout} />
      <div className="min-w-0 flex-1">
        <header className="flex items-center justify-end border-b border-gray-200 bg-white/80 px-4 py-3 backdrop-blur sm:px-6">
          <span className="truncate text-sm text-gray-500">{user.email}</span>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">{children}</main>
      </div>
    </div>
  )
}
