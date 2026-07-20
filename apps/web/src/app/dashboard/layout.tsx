'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../contexts/AuthContext'
import { useBrand } from '../../contexts/BrandContext'
import { AssistantProvider } from '../../contexts/AssistantContext'
import { ViewModeProvider } from '../../contexts/ViewModeProvider'
import { TopNav } from '../../components/TopNav'
import { Selfie } from '../../components/Selfie'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth()
  const { brands, activeBrandId, setActiveBrandId } = useBrand()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [user, loading, router])

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent-soft border-t-accent" />
      </div>
    )
  }

  return (
    <AssistantProvider>
      <ViewModeProvider>
        <div className="min-h-screen bg-bg">
          <TopNav
            email={user.email ?? ''}
            onLogout={logout}
            brands={brands}
            activeBrandId={activeBrandId}
            onBrandChange={setActiveBrandId}
          />
          <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
          <Selfie />
        </div>
      </ViewModeProvider>
    </AssistantProvider>
  )
}
