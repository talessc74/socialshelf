'use client'

import { useState } from 'react'
import { sendPasswordResetEmail } from 'firebase/auth'
import Link from 'next/link'
import { auth } from '../../lib/firebase'

function resetErrorMessage(err: unknown): string {
  const code = err instanceof Error && 'code' in err ? String((err as { code: unknown }).code) : ''
  if (code === 'auth/invalid-email') return 'Email inválido.'
  return 'Não foi possível enviar o email. Tente novamente.'
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await sendPasswordResetEmail(auth, email)
      setSent(true)
    } catch (err) {
      setError(resetErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm rounded-3xl border border-contrast-ink/10 bg-contrast-ink/10 p-8 shadow-2xl backdrop-blur-xl">
        <p className="mb-1 text-center text-xs font-semibold uppercase tracking-wide text-accent">
          Recuperar acesso
        </p>
        <h1 className="mb-6 text-center text-2xl font-bold text-ink">Esqueci minha senha</h1>

        {sent ? (
          <p className="text-center text-sm text-ink/80">
            Se existe uma conta com o email <strong>{email}</strong>, enviamos um link para redefinir a senha.
            Verifique sua caixa de entrada (e o spam).
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
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

            {error && <p className="text-sm text-red-300">{error}</p>}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-ink shadow-lg shadow-accent/40 hover:bg-accent disabled:opacity-50"
            >
              {busy ? 'Enviando…' : 'Enviar link de redefinição'}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-ink/60">
          <Link href="/login" className="font-semibold text-accent hover:underline">
            Voltar para o login
          </Link>
        </p>
      </div>
    </main>
  )
}
