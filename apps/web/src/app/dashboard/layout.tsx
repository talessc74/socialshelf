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
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="border-b border-gray-200 bg-white px-6 py-3">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/dashboard" className="text-lg font-bold text-brand-700">
            SocialShelf
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">{user.email}</span>
            <button
              onClick={logout}
              className="text-sm text-gray-600 hover:text-red-600"
            >
              Sair
            </button>
          </div>
        </div>
      </nav>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  )
}
