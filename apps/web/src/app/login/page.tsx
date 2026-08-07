'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { signInWithEmailAndPassword } from 'firebase/auth'
import Link from 'next/link'
import { auth } from '../../lib/firebase'
import { useAuth } from '../../contexts/AuthContext'
import GoogleSignInButton from '../../components/GoogleSignInButton'

export default function LoginPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!loading && user) router.replace('/dashboard')
  }, [user, loading, router])

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await signInWithEmailAndPassword(auth, email, password)
      router.replace('/dashboard')
    } catch {
      setError('Email ou senha inválidos.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm rounded-3xl border border-contrast-ink/10 bg-contrast-ink/10 p-8 shadow-2xl backdrop-blur-xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo-icon.png"
          alt="SocialShelf"
          className="mx-auto mb-4 h-16 w-16 rounded-2xl shadow-lg"
        />
        <p className="mb-1 text-center text-xs font-semibold uppercase tracking-wide text-accent-text">
          Bem-vindo de volta
        </p>
        <h1 className="mb-6 text-center text-2xl font-bold text-ink">SocialShelf</h1>

        <form onSubmit={handleEmail} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink/80">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-contrast-ink/15 bg-contrast-ink/10 px-3 py-2 text-sm text-ink placeholder-ink/40 focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder="seu@email.com"
            />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="block text-sm font-medium text-ink/80">Senha</label>
              <Link href="/forgot-password" className="text-xs font-medium text-accent-text underline">
                Esqueci minha senha
              </Link>
            </div>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-contrast-ink/15 bg-contrast-ink/10 px-3 py-2 text-sm text-ink placeholder-ink/40 focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-sm text-red-300">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-contrast px-4 py-2 text-sm font-semibold text-contrast-ink shadow-lg shadow-contrast/40 hover:bg-contrast disabled:opacity-50"
          >
            {busy ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        <div className="my-4 flex items-center gap-2">
          <div className="h-px flex-1 bg-contrast-ink/15" />
          <span className="text-xs text-ink/40">ou</span>
          <div className="h-px flex-1 bg-contrast-ink/15" />
        </div>

        <GoogleSignInButton onSuccess={() => router.replace('/dashboard')} onError={setError} />

        <p className="mt-6 text-center text-sm text-ink/60">
          Não tem conta?{' '}
          <Link href="/signup" className="font-semibold text-accent-text underline">
            Cadastre-se
          </Link>
        </p>
      </div>
    </main>
  )
}
