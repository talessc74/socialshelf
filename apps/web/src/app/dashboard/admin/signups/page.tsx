'use client'

import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ExternalLink } from 'lucide-react'
import { api, type ApiAdminSignupEntry } from '../../../../lib/api'

// Link estável da Meta pra "Minhas Apps" (developers.facebook.com/apps) — não dá pra linkar
// direto pra tela de Roles/Testers de um app específico sem o App ID (META_APP_ID é segredo,
// não lido aqui); o admin clica, escolhe o app do SocialShelf e vai em Funções do app.
const META_APPS_DASHBOARD_URL = 'https://developers.facebook.com/apps/'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function SignupRow({ signup }: { signup: ApiAdminSignupEntry }) {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: (handled: boolean) => api.markSignupHandled(signup.userId, handled),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'signups'] }),
  })

  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
      <div>
        <p className="font-medium text-ink">{signup.email ?? signup.userId}</p>
        <p className="text-sm text-muted">Cadastrou em {formatDate(signup.signedUpAt)}</p>
      </div>
      <label className="flex items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          checked={signup.metaTesterHandled}
          disabled={mutation.isPending}
          onChange={(e) => mutation.mutate(e.target.checked)}
          className="h-4 w-4 rounded border-line"
        />
        Liberado como testador do Instagram/Facebook
      </label>
    </li>
  )
}

export default function AdminSignupsPage() {
  const router = useRouter()

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'signups'],
    queryFn: () => api.getAdminSignups(),
    retry: false,
  })

  const pending = data?.signups.filter((s) => !s.metaTesterHandled) ?? []
  const handled = data?.signups.filter((s) => s.metaTesterHandled) ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="text-sm text-muted hover:text-ink">
          ← Voltar
        </button>
        <h1 className="text-2xl font-bold text-ink">Cadastros novos</h1>
      </div>

      <p className="text-sm text-muted">
        Quem ainda não foi cadastrado manualmente como testador do app da Meta aparece em{' '}
        <strong>Pendentes</strong> — enquanto o app não passa por App Review, Instagram e Facebook só publicam pra
        quem foi liberado assim (ver <strong>_local-bdr-policy-012</strong>). Marcar aqui não libera nada
        automaticamente: é só um lembrete de quem já teve a parte manual feita no painel da Meta.
      </p>

      <div className="rounded-2xl border border-line bg-card p-4 shadow-card">
        <p className="text-sm text-ink">
          <strong>Sua parte, pra cada pessoa pendente:</strong> abra o app do SocialShelf no painel da Meta →
          Funções do app → Testadores → Adicionar testadores, e informe o e-mail ou usuário do Instagram/Facebook
          da pessoa.
        </p>
        <a
          href={META_APPS_DASHBOARD_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-ink hover:bg-accent/90"
        >
          Abrir Meta for Developers
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted">Carregando…</p>
      ) : error ? (
        <p className="text-sm text-red-600">Não foi possível carregar os cadastros. Você tem acesso a esta página?</p>
      ) : !data || data.signups.length === 0 ? (
        <p className="text-sm text-muted">Nenhum cadastro encontrado.</p>
      ) : (
        <div className="space-y-4">
          <section className="rounded-2xl border border-line bg-card p-4 shadow-card">
            <h2 className="text-lg font-semibold text-ink">Pendentes ({pending.length})</h2>
            {pending.length === 0 ? (
              <p className="mt-2 text-sm text-muted">Nenhum cadastro pendente.</p>
            ) : (
              <ul className="divide-y divide-line">
                {pending.map((signup) => (
                  <SignupRow key={signup.userId} signup={signup} />
                ))}
              </ul>
            )}
          </section>

          {handled.length > 0 && (
            <section className="rounded-2xl border border-line bg-card p-4 shadow-card">
              <h2 className="text-lg font-semibold text-ink">Já liberados ({handled.length})</h2>
              <ul className="divide-y divide-line">
                {handled.map((signup) => (
                  <SignupRow key={signup.userId} signup={signup} />
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
