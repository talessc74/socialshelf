'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import Link from 'next/link'
import { auth } from '../../lib/firebase'
import { useAuth } from '../../contexts/AuthContext'
import GoogleSignInButton from '../../components/GoogleSignInButton'

function authErrorMessage(err: unknown): string {
  const code = err instanceof Error && 'code' in err ? String((err as { code: unknown }).code) : ''
  if (code === 'auth/email-already-in-use') return 'Esse email já tem uma conta. Tente entrar.'
  if (code === 'auth/weak-password') return 'A senha precisa ter pelo menos 6 caracteres.'
  if (code === 'auth/invalid-email') return 'Email inválido.'
  return 'Não foi possível criar a conta. Tente novamente.'
}

export default function SignupPage() {
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
      await createUserWithEmailAndPassword(auth, email, password)
      router.replace('/dashboard')
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm rounded-3xl border border-contrast-ink/10 bg-contrast-ink/10 p-8 shadow-2xl backdrop-blur-xl">
        <p className="mb-1 text-center text-xs font-semibold uppercase tracking-wide text-accent">
          Vamos começar
        </p>
        <h1 className="mb-6 text-center text-2xl font-bold text-ink">Criar conta no SocialShelf</h1>

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
            <label className="mb-1 block text-sm font-medium text-ink/80">Senha</label>
            <input
              type="password"
              required
              minLength={6}
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
            className="w-full rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-ink shadow-lg shadow-accent/40 hover:bg-accent disabled:opacity-50"
          >
            {busy ? 'Criando conta…' : 'Criar conta'}
          </button>
        </form>

        <div className="my-4 flex items-center gap-2">
          <div className="h-px flex-1 bg-contrast-ink/15" />
          <span className="text-xs text-ink/40">ou</span>
          <div className="h-px flex-1 bg-contrast-ink/15" />
        </div>

        <GoogleSignInButton onSuccess={() => router.replace('/dashboard')} onError={setError} />

        <p className="mt-6 text-center text-sm text-ink/60">
          Já tem conta?{' '}
          <Link href="/login" className="font-semibold text-accent hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </main>
  )
}
