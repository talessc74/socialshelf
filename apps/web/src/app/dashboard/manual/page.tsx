'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'

// Conteúdo reaproveitado de apps/generator/src/infrastructure/vertexai/selfieKnowledgeBase.ts
// (_local-bdr-policy-015) — mesmo texto-base usado no prompt do Selfie, reformatado aqui como
// página navegável. Mantido em sincronia manualmente entre os dois arquivos, mesmo padrão já
// usado em PlanLimits.ts/plans/page.tsx e priceMapping.ts/credits/page.tsx.

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-2xl border border-line bg-card p-4 shadow-card">
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      <div className="space-y-3 text-sm text-ink/90">{children}</div>
    </section>
  )
}

const MENU_ITEMS: { href: string; label: string; description: string }[] = [
  { href: '/dashboard', label: 'Início', description: 'Painel geral com um resumo da marca.' },
  { href: '/dashboard/news', label: 'Notícias', description: 'Sugestões de pautas/notícias para gerar conteúdo.' },
  { href: '/dashboard/generate', label: 'Gerar com IA', description: 'Cria posts (texto e imagem) com inteligência artificial.' },
  { href: '/dashboard/compose', label: 'Novo Post', description: 'Cria um post manualmente, sem IA.' },
  { href: '/dashboard/campaigns', label: 'Campanhas', description: 'Conjuntos de posts organizados por tema/campanha.' },
  { href: '/dashboard/scheduled', label: 'Agendados', description: 'Posts já programados para publicar em data futura.' },
  { href: '/dashboard/insights', label: 'Insights', description: 'Sugestões e análises sobre o que postar.' },
  { href: '/dashboard/performance', label: 'Performance', description: 'Métricas reais dos posts já publicados por rede.' },
  { href: '/dashboard/accounts', label: 'Contas', description: 'Central de Contas: conectar e gerenciar as redes sociais da marca.' },
  { href: '/dashboard/brand', label: 'Marca', description: 'Configurações da marca (perfil, limites, preferências).' },
  { href: '/dashboard/ai-usage', label: 'Meus Gastos de IA', description: 'Saldo de créditos de IA do plano do usuário.' },
  { href: '/dashboard/billing', label: 'Assinatura', description: 'Plano atual e opções de upgrade.' },
]

const CONNECTION_ISSUES: { problem: string; solution: string }[] = [
  {
    problem: 'Erro de token expirado / "sessão expirou" / conexão perdeu permissão',
    solution:
      'Toda conexão tem prazo de validade. Volte em Contas e clique em "Reconectar" no card daquela rede — é o mesmo processo de conectar pela primeira vez.',
  },
  {
    problem: '"Nenhuma Página do Facebook encontrada"',
    solution: 'A conta logou certo, mas não administra nenhuma Página do Facebook. Crie uma Página (grátis) antes de conectar.',
  },
  {
    problem: '"Nenhuma Página do LinkedIn administrada foi encontrada"',
    solution:
      'Só acontece ao usar "Conectar Página do LinkedIn" sem administrar nenhuma Página de empresa. Use o botão "Conectar" normal pra conectar o perfil pessoal em vez disso.',
  },
  {
    problem: 'Facebook conectou mas o Instagram não',
    solution:
      'A Página escolhida não tem conta profissional do Instagram vinculada a ela — vincule isso nas configurações do Facebook e reconecte.',
  },
  {
    problem: 'Métricas do Facebook não aparecem mesmo com a conexão saudável',
    solution:
      'A Meta só libera dados de Performance para Páginas com pelo menos 100 seguidores — não é problema de conexão, reconectar não resolve; é preciso continuar publicando até a Página crescer.',
  },
]

export default function ManualPage() {
  const router = useRouter()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="text-sm text-muted hover:text-ink">
          ← Voltar
        </button>
        <h1 className="text-2xl font-bold text-ink">Manual do SocialShelf</h1>
      </div>

      <p className="text-sm text-muted">
        Um guia rápido de como o produto funciona. Pra uma dúvida específica sobre a sua conta — ex. "por que minhas
        métricas não aparecem?" — o Selfie (o mascote no canto da tela) também responde, vendo o estado real das
        suas conexões.
      </p>

      <Section title="O que é o SocialShelf">
        <p>
          O SocialShelf é uma plataforma que ajuda a criar, agendar e publicar conteúdo em redes sociais com apoio de
          inteligência artificial, e a acompanhar o desempenho dos posts já publicados.
        </p>
      </Section>

      <Section title="Menu principal">
        <ul className="divide-y divide-line">
          {MENU_ITEMS.map((item) => (
            <li key={item.href} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2">
              <Link href={item.href} className="font-medium text-accent hover:underline">
                {item.label}
              </Link>
              <span className="text-muted">{item.description}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Como conectar cada rede social">
        <p>
          Tudo isso acontece em{' '}
          <Link href="/dashboard/accounts" className="font-medium text-accent hover:underline">
            Central de Contas
          </Link>
          .
        </p>
        <div>
          <h3 className="font-medium text-ink">Instagram e Facebook</h3>
          <p>Andam juntos, mas há duas formas de conectar o Instagram:</p>
          <ol className="ml-5 list-decimal space-y-1">
            <li>
              <strong>Com Facebook</strong> (conecta os dois de uma vez): botão &quot;Conectar&quot; no card do Facebook ou do
              Instagram. Faça login na Meta/Facebook, escolha a Página (se tiver mais de uma); se essa Página tiver
              uma conta Instagram profissional vinculada, o Instagram conecta junto.
            </li>
            <li>
              <strong>Só o Instagram, sem Facebook</strong>: botão &quot;Conectar sem Facebook&quot; no card do Instagram — login
              direto na conta profissional do Instagram, sem precisar de Página nem conta do Facebook.
            </li>
          </ol>
          <p className="mt-2">
            Pré-requisito do Instagram: a conta precisa ser profissional (Business ou Creator) — um perfil pessoal
            não pode ser conectado. Para converter: no app do Instagram, Configurações → Tipo de conta e ferramentas
            → Mudar para conta profissional (grátis). Pré-requisito do Facebook: é preciso administrar pelo menos
            uma Página.
          </p>
        </div>
        <div>
          <h3 className="font-medium text-ink">LinkedIn</h3>
          <p>
            Duas conexões independentes — &quot;Conectar&quot; (perfil pessoal) e &quot;Conectar Página do LinkedIn&quot; (uma Página de
            empresa administrada pelo usuário). Pode usar as duas ao mesmo tempo.
          </p>
        </div>
        <div>
          <h3 className="font-medium text-ink">X (antigo Twitter) e TikTok</h3>
          <p>Um clique em &quot;Conectar&quot;, login, autorizar.</p>
        </div>
      </Section>

      <Section title="Problemas comuns de conexão">
        <dl className="space-y-3">
          {CONNECTION_ISSUES.map(({ problem, solution }) => (
            <div key={problem}>
              <dt className="font-medium text-ink">{problem}</dt>
              <dd className="text-muted">{solution}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section title="Créditos de IA">
        <p>
          Cada plano inclui um saldo mensal de créditos de IA, que reseta todo mês (sem acúmulo do mês anterior —
          &quot;usa ou perde&quot;). É possível comprar créditos avulsos, que nunca expiram e só são usados depois que o saldo
          do plano do mês acabar.
        </p>
        <p>
          Seu saldo atual aparece em &quot;Meus Gastos de IA&quot; no menu principal (acima). Pra comprar créditos
          avulsos, acesse{' '}
          <Link href="/dashboard/billing/credits" className="font-medium text-accent hover:underline">
            Comprar créditos
          </Link>
          .
        </p>
      </Section>
    </div>
  )
}
