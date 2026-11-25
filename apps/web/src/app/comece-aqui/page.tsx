import type { Metadata } from 'next'
import Link from 'next/link'
import { UserCheck, Mail, Smartphone, ShieldCheck, ExternalLink } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Como entrar no SocialShelf',
  description: 'Guia para quem quer assinar o SocialShelf: o que funciona na hora e o que depende de validação manual.',
}

// Página pública (fora do login), pensada pra ser enviada a um prospect ANTES de ele criar
// conta — não é conteúdo do dashboard (isso é /dashboard/manual). _local-bdr-policy-016.
// Diagramas por ícone em vez de screenshot real do Instagram/Meta: não temos login nessas
// contas pra capturar a tela de verdade, e a interface deles muda com frequência — um
// screenshot desatualizado confundiria mais do que ajudaria. Tem CSS de impressão (classe
// print:) pra virar um PDF limpo via "Salvar como PDF" do navegador, sem precisar de um
// pipeline de geração à parte (diferente do Guia Visual, que é outro documento).
const INSTAGRAM_PROFESSIONAL_ACCOUNT_HELP_URL = 'https://help.instagram.com/502981923235522'
const META_APP_ROLES_HELP_URL = 'https://developers.facebook.com/docs/development/build-and-test/app-roles'

function ExternalRef({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 font-medium text-accent hover:underline"
    >
      {children}
      <ExternalLink className="h-3.5 w-3.5" />
    </a>
  )
}

function StepCard({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof UserCheck
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="flex gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent print:hidden">
        <Icon className="h-5 w-5" />
      </div>
      <div className="space-y-1">
        <p className="font-medium text-ink">{title}</p>
        <div className="text-sm text-ink/90">{children}</div>
      </div>
    </div>
  )
}

export default function ComeceAquiPage() {
  return (
    <main className="min-h-screen bg-bg px-4 py-12 print:bg-white print:py-4">
      <div className="mx-auto max-w-2xl">
        <Link href="/" className="text-sm font-medium text-accent hover:underline print:hidden">
          ← SocialShelf
        </Link>

        <h1 className="mb-2 mt-6 text-3xl font-bold text-ink">Como entrar no SocialShelf</h1>
        <p className="mb-8 text-sm text-muted">
          Um resumo antes de você criar sua conta: o que você consegue fazer sozinho, na hora, e o único passo que
          depende da gente.
        </p>

        <div className="space-y-8 text-ink/90">
          <section className="space-y-3 rounded-2xl border border-line bg-card p-4 shadow-card print:border-0 print:p-0 print:shadow-none">
            <h2 className="text-lg font-semibold text-ink">O que funciona na hora, sem esperar ninguém</h2>
            <ul className="ml-5 list-disc space-y-2">
              <li>Criar sua conta (e-mail/senha ou login com Google).</li>
              <li>Conectar LinkedIn, X (antigo Twitter) ou TikTok.</li>
              <li>Gerar e publicar seu primeiro post com apoio de IA.</li>
            </ul>
            <p>
              Se você só pretende usar essas redes, pode{' '}
              <Link href="/signup" className="font-medium text-accent hover:underline">
                criar sua conta agora
              </Link>{' '}
              e começar a publicar direto — nenhuma etapa extra, nenhuma espera.
            </p>
          </section>

          <section className="space-y-4 rounded-2xl border border-line bg-card p-4 shadow-card print:border-0 print:p-0 print:shadow-none">
            <h2 className="text-lg font-semibold text-ink">Se você quiser usar Instagram ou Facebook</h2>
            <p>
              Essas duas redes têm um passo a mais, por enquanto. O SocialShelf ainda está no meio do processo
              oficial de homologação do Instagram/Facebook (o que a Meta chama de &quot;App Review&quot;) — até essa
              revisão ser aprovada, só contas liberadas manualmente por nós conseguem publicar por essas redes.
              Isso não é uma limitação do seu perfil nem exige nada técnico da sua parte.
            </p>

            <div className="rounded-xl bg-accent-soft/60 p-3 text-sm">
              <strong>Pré-requisito do Instagram:</strong> a conta precisa ser profissional (Business ou Creator) —
              um perfil pessoal não pode ser conectado, independente da liberação como testador. Para converter:
              Instagram → Configurações → Tipo de conta e ferramentas → Mudar para conta profissional (grátis,
              menos de um minuto). Veja o{' '}
              <ExternalRef href={INSTAGRAM_PROFESSIONAL_ACCOUNT_HELP_URL}>artigo oficial do Instagram</ExternalRef>{' '}
              se precisar do passo a passo completo.
            </div>

            <div className="space-y-4">
              <StepCard icon={UserCheck} title="1. Crie sua conta">
                <Link href="/signup" className="font-medium text-accent hover:underline">
                  Criar conta no SocialShelf
                </Link>{' '}
                — normalmente, igual à seção acima.
              </StepCard>

              <StepCard icon={Mail} title="2. Avise a gente (ou só aguarde)">
                Mande um e-mail pra{' '}
                <a href="mailto:contato@socialshelf.com.br" className="font-medium text-accent hover:underline">
                  contato@socialshelf.com.br
                </a>{' '}
                dizendo que quer conectar Instagram ou Facebook — ou simplesmente aguarde, acompanhamos os
                cadastros novos e liberamos sem precisar de aviso. Normalmente a liberação acontece em até 1 dia
                útil.
              </StepCard>

              <StepCard icon={Smartphone} title="3. Aceite o convite de testador no Instagram">
                Depois de liberado, você recebe um convite de &quot;testador&quot; do app SocialShelf. Pra aceitar: abra o{' '}
                <a
                  href="https://www.instagram.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-accent hover:underline"
                >
                  app do Instagram
                </a>{' '}
                → Configurações → Apps e sites → Convites de testador, e aceite o convite de lá. Quem administra
                também uma Página do{' '}
                <a
                  href="https://www.facebook.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-accent hover:underline"
                >
                  Facebook
                </a>{' '}
                recebe um convite parecido por lá. Mais detalhes na{' '}
                <ExternalRef href={META_APP_ROLES_HELP_URL}>documentação oficial da Meta sobre papéis de app</ExternalRef>
                .
              </StepCard>

              <StepCard icon={ShieldCheck} title="4. Confirme que funcionou">
                Só depois de aceitar o convite a conexão funciona de verdade — sem esse passo, a conexão no
                SocialShelf pode até parecer concluída, mas a publicação falha.
              </StepCard>
            </div>
          </section>

          <section className="space-y-3 rounded-2xl border border-line bg-card p-4 shadow-card print:border-0 print:p-0 print:shadow-none">
            <h2 className="text-lg font-semibold text-ink">Resumo</h2>
            <p>
              Crie sua conta a qualquer momento. LinkedIn, X e TikTok funcionam na hora. Instagram e Facebook
              exigem conta profissional (não pessoal) e dependem de uma liberação manual nossa (normalmente até 1
              dia útil) e, do seu lado, de aceitar o convite de testador no Instagram — sem isso, a publicação não
              funciona nessas duas redes.
            </p>
          </section>

          <Link
            href="/signup"
            className="flex w-fit items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink hover:bg-accent/90 print:hidden"
          >
            Criar minha conta
          </Link>
        </div>
      </div>
    </main>
  )
}
