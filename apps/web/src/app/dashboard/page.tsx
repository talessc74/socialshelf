'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Sparkles, Send, BarChart3, Tag } from 'lucide-react'
import { api } from '../../lib/api'
import { BrandIdentityCard } from '../../components/BrandIdentityCard'
import { LogoImage } from '../../components/LogoImage'
import { useAuth } from '../../contexts/AuthContext'

const SHORTCUTS = [
  { href: '/dashboard/generate', label: 'Gerar com IA', description: 'Crie posts com inteligência artificial', icon: Sparkles },
  { href: '/dashboard/compose', label: 'Novo Post', description: 'Escreva e publique manualmente', icon: Send },
  { href: '/dashboard/performance', label: 'Performance', description: 'Veja o que está funcionando', icon: BarChart3 },
  { href: '/dashboard/brand', label: 'Marca', description: 'Identidade e voz da marca', icon: Tag },
]

function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Bom dia'
  if (hour < 18) return 'Boa tarde'
  return 'Boa noite'
}

export default function DashboardPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { user } = useAuth()
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const { data: brandProfile } = useQuery({
    queryKey: ['brand-profile'],
    queryFn: () => api.getBrandProfile(),
  })

  useEffect(() => {
    const connected = searchParams.get('connected')
    const error = searchParams.get('error')

    if (connected) {
      const platforms = connected.split(',').join(', ')
      setNotice({ type: 'success', message: `Conectado com sucesso: ${platforms}` })
      router.replace('/dashboard')
    } else if (error) {
      const detail = searchParams.get('detail')
      setNotice({ type: 'error', message: `Falha ao conectar plataforma. Tente novamente.${detail ? ` [${detail}]` : ''}` })
      router.replace('/dashboard')
    }
  }, [searchParams, router])

  return (
    <div className="space-y-8">
      {notice && (
        <div
          className={`rounded-lg px-4 py-3 text-sm font-medium ${
            notice.type === 'success'
              ? 'bg-green-50 text-green-800'
              : 'bg-red-50 text-red-800'
          }`}
        >
          {notice.message}
          <button
            onClick={() => setNotice(null)}
            className="ml-4 text-xs underline opacity-70"
          >
            Fechar
          </button>
        </div>
      )}

      <div className="flex flex-col gap-5 rounded-2xl border border-brand-100 bg-white p-6 shadow-sm shadow-brand-100/60 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {greeting()}, <span className="text-brand-600">{user?.email?.split('@')[0] ?? 'bem-vindo'}</span>.
          </h1>
          <p className="mt-1 text-sm text-gray-500">Sua central para criar e acompanhar posts com a SocialShelf.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/dashboard/generate"
              className="whitespace-nowrap rounded-xl bg-brand-600 px-4 py-2 text-center text-sm font-semibold text-white shadow-sm shadow-brand-200 hover:bg-brand-700"
            >
              Explorar oportunidades
            </Link>
            <Link
              href="/dashboard/brand"
              className="whitespace-nowrap rounded-xl border border-brand-100 bg-white px-4 py-2 text-center text-sm font-semibold text-gray-700 shadow-sm hover:border-brand-300 hover:bg-brand-50"
            >
              Configurar minha marca
            </Link>
          </div>
        </div>
        {brandProfile?.visual.logoStoragePath ? (
          <LogoImage
            path={brandProfile.visual.logoStoragePath}
            className="h-16 w-16 shrink-0 rounded-2xl border border-gray-100 sm:h-20 sm:w-20"
          />
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-xl font-bold text-brand-600 sm:h-20 sm:w-20">
            {(user?.email?.[0] ?? 'S').toUpperCase()}
          </div>
        )}
      </div>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-gray-800">Atalhos</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SHORTCUTS.map(({ href, label, description, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-start gap-3 rounded-2xl border border-brand-100 bg-white p-5 shadow-sm transition-shadow hover:border-brand-300 hover:shadow-brand-100/60"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <Icon className="h-5 w-5" />
              </span>
              <div>
                <p className="font-semibold text-gray-800">{label}</p>
                <p className="text-xs text-gray-500">{description}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {brandProfile && <BrandIdentityCard brandProfile={brandProfile} />}
    </div>
  )
}
