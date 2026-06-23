'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../contexts/AuthContext'
import { TopNav } from '../../components/TopNav'

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
    <div className="min-h-screen bg-surface-operation-dots">
      <TopNav email={user.email ?? ''} onLogout={logout} />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  )
}
