'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
} from 'firebase/auth'
import Link from 'next/link'
import { auth } from '../../lib/firebase'
import { useAuth } from '../../contexts/AuthContext'

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

  const handleGoogle = async () => {
    setError('')
    setBusy(true)
    try {
      await signInWithPopup(auth, new GoogleAuthProvider())
      router.replace('/dashboard')
    } catch {
      setError('Não foi possível entrar com Google.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-diagnostic-gradient px-4">
      <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-white/10 p-8 shadow-2xl backdrop-blur-xl">
        <p className="mb-1 text-center text-xs font-semibold uppercase tracking-wide text-brand-200">
          Bem-vindo de volta
        </p>
        <h1 className="mb-6 text-center text-2xl font-bold text-white">SocialShelf</h1>

        <form onSubmit={handleEmail} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-white/80">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-brand-300"
              placeholder="seu@email.com"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-white/80">Senha</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-brand-300"
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-sm text-red-300">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-gray-900 shadow-lg shadow-brand-900/40 hover:bg-brand-300 disabled:opacity-50"
          >
            {busy ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        <div className="my-4 flex items-center gap-2">
          <div className="h-px flex-1 bg-white/15" />
          <span className="text-xs text-white/40">ou</span>
          <div className="h-px flex-1 bg-white/15" />
        </div>

        <button
          onClick={handleGoogle}
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/90 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-white disabled:opacity-50"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Entrar com Google
        </button>

        <p className="mt-6 text-center text-sm text-white/60">
          Não tem conta?{' '}
          <Link href="/signup" className="font-semibold text-brand-200 hover:underline">
            Cadastre-se
          </Link>
        </p>
      </div>
    </main>
  )
}
