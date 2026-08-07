'use client'

import { useState } from 'react'
import { sendPasswordResetEmail } from 'firebase/auth'
import Link from 'next/link'
import { auth } from '../../lib/firebase'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      await sendPasswordResetEmail(auth, email)
    } catch {
      // Não revela se o email existe ou não (evita enumeração de contas) —
      // a mensagem exibida é a mesma independente do resultado.
    } finally {
      setBusy(false)
      setSent(true)
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
          Recuperar acesso
        </p>
        <h1 className="mb-6 text-center text-2xl font-bold text-ink">Esqueci minha senha</h1>

        {sent ? (
          <p className="text-center text-sm text-ink/80">
            Se esse email tiver uma conta no SocialShelf, enviamos um link para redefinir a senha.
            Confira sua caixa de entrada.
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

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-contrast px-4 py-2 text-sm font-semibold text-contrast-ink shadow-lg shadow-contrast/40 hover:bg-contrast disabled:opacity-50"
            >
              {busy ? 'Enviando…' : 'Enviar link de recuperação'}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-ink/60">
          Lembrou a senha?{' '}
          <Link href="/login" className="font-semibold text-accent-text underline">
            Entrar
          </Link>
        </p>
      </div>
    </main>
  )
}
