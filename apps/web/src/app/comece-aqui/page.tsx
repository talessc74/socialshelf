import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Como entrar no SocialShelf',
  description: 'Guia para quem quer assinar o SocialShelf: o que funciona na hora e o que depende de validação manual.',
}

// Página pública (fora do login), pensada pra ser enviada a um prospect ANTES de ele criar
// conta — não é conteúdo do dashboard (isso é /dashboard/manual). _local-bdr-policy-016.
export default function ComeceAquiPage() {
  return (
    <main className="min-h-screen bg-bg px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <Link href="/" className="text-sm font-medium text-accent hover:underline">
          ← SocialShelf
        </Link>

        <h1 className="mb-2 mt-6 text-3xl font-bold text-ink">Como entrar no SocialShelf</h1>
        <p className="mb-8 text-sm text-muted">
          Um resumo antes de você criar sua conta: o que você consegue fazer sozinho, na hora, e o único passo que
          depende da gente.
        </p>

        <div className="space-y-8 text-ink/90">
          <section className="space-y-3 rounded-2xl border border-line bg-card p-4 shadow-card">
            <h2 className="text-lg font-semibold text-ink">O que funciona na hora, sem esperar ninguém</h2>
            <ul className="ml-5 list-disc space-y-2">
              <li>Criar sua conta (e-mail/senha ou login com Google).</li>
              <li>Conectar LinkedIn, X (antigo Twitter) ou TikTok.</li>
              <li>Gerar e publicar seu primeiro post com apoio de IA.</li>
            </ul>
            <p>
              Se você só pretende usar essas redes, pode criar sua conta agora e começar a publicar direto — nenhuma
              etapa extra, nenhuma espera.
            </p>
          </section>

          <section className="space-y-3 rounded-2xl border border-line bg-card p-4 shadow-card">
            <h2 className="text-lg font-semibold text-ink">Se você quiser usar Instagram ou Facebook</h2>
            <p>
              Essas duas redes têm um passo a mais, por enquanto. O SocialShelf ainda está no meio do processo
              oficial de homologação do Instagram/Facebook (o que a Meta chama de &quot;App Review&quot;) — até essa
              revisão ser aprovada, só contas liberadas manualmente por nós conseguem publicar por essas redes.
              Isso não é uma limitação do seu perfil nem exige nada técnico da sua parte.
            </p>
            <ol className="ml-5 list-decimal space-y-2">
              <li>Crie sua conta normalmente (ver seção acima).</li>
              <li>
                Avise a gente em{' '}
                <a href="mailto:contato@socialshelf.com.br" className="font-medium text-accent hover:underline">
                  contato@socialshelf.com.br
                </a>{' '}
                que você quer conectar Instagram ou Facebook (ou simplesmente aguarde — acompanhamos os cadastros
                novos e liberamos sem precisar de aviso). Normalmente a liberação acontece em até 1 dia útil.
              </li>
              <li>
                Depois de liberado, você recebe um convite de &quot;testador&quot; no próprio Instagram. Pra aceitar: abra o
                app do Instagram → Configurações → Apps e sites → Convites de testador, e aceite o convite de lá.
              </li>
              <li>
                Só depois de aceitar o convite a conexão funciona de verdade — sem esse passo, a conexão no
                SocialShelf pode até parecer concluída, mas a publicação falha.
              </li>
            </ol>
          </section>

          <section className="space-y-3 rounded-2xl border border-line bg-card p-4 shadow-card">
            <h2 className="text-lg font-semibold text-ink">Resumo</h2>
            <p>
              Crie sua conta a qualquer momento. LinkedIn, X e TikTok funcionam na hora. Instagram e Facebook
              dependem de uma liberação manual nossa (normalmente até 1 dia útil) e, do seu lado, de aceitar o
              convite de testador no Instagram — sem isso, a publicação não funciona nessas duas redes.
            </p>
          </section>

          <Link
            href="/signup"
            className="flex w-fit items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink hover:bg-accent/90"
          >
            Criar minha conta
          </Link>
        </div>
      </div>
    </main>
  )
}
