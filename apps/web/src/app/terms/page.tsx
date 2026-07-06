import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Termos de Uso — SocialShelf',
  description: 'Termos de uso do SocialShelf',
}

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-bg px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <Link href="/" className="text-sm font-medium text-accent hover:underline">
          ← SocialShelf
        </Link>

        <h1 className="mb-2 mt-6 text-3xl font-bold text-ink">Termos de Uso</h1>
        <p className="mb-8 text-sm text-muted">Última atualização: 6 de julho de 2026</p>

        <div className="space-y-8 text-ink/90">
          <section>
            <h2 className="mb-2 text-lg font-semibold text-ink">1. Quem oferece o serviço</h2>
            <p>
              O SocialShelf é um produto operado por <strong>Rádio Kactus</strong>
              {' '}(CNPJ a ser incluído nesta página assim que o registro formal da empresa
              for concluído). Ao usar o SocialShelf, você concorda com estes Termos de Uso.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-ink">2. O que é o SocialShelf</h2>
            <p>
              O SocialShelf é uma plataforma de publicação social voltada a pequenos
              criadores de conteúdo que gerenciam suas próprias redes. O serviço permite:
            </p>
            <ul className="ml-5 mt-2 list-disc space-y-1">
              <li>Conectar contas de redes sociais (LinkedIn, X, Instagram, Facebook, TikTok) via OAuth;</li>
              <li>Gerar textos, imagens, áudio e vídeo com apoio de inteligência artificial;</li>
              <li>Agendar e publicar conteúdo nessas redes a partir de uma interface única;</li>
              <li>Acompanhar o desempenho do que foi publicado.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-ink">3. Conexão com redes sociais</h2>
            <p>
              O SocialShelf nunca solicita ou armazena o login e a senha das suas redes
              sociais. A conexão é feita exclusivamente via OAuth — o protocolo oficial
              de autorização de cada plataforma — e você pode revogar o acesso a
              qualquer momento, tanto pelo SocialShelf quanto diretamente na rede social
              conectada.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-ink">4. Conteúdo enviado por você</h2>
            <p>
              Você é responsável pelo conteúdo que envia ou publica através do
              SocialShelf, incluindo imagens, vídeos e áudios enviados manualmente.
              Ao enviar um arquivo que contenha pessoas, marcas ou obras de terceiros,
              você declara possuir os direitos necessários para publicá-lo nas redes
              conectadas.
            </p>
            <p className="mt-2">
              Arquivos enviados por você para geração de vídeo ficam disponíveis para
              download por até 7 dias após a publicação, e são excluídos
              automaticamente ao final desse prazo.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-ink">5. Conteúdo gerado por IA</h2>
            <p>
              Textos, imagens, áudio e vídeo gerados pela inteligência artificial do
              SocialShelf são fornecidos como rascunho para uso do usuário. Você é
              responsável por revisar o conteúdo gerado antes de publicá-lo em suas
              redes sociais.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-ink">6. Uso aceitável</h2>
            <p>Você concorda em não usar o SocialShelf para:</p>
            <ul className="ml-5 mt-2 list-disc space-y-1">
              <li>Publicar conteúdo ilegal, difamatório ou que viole direitos de terceiros;</li>
              <li>Tentar acessar contas, dados ou sistemas sem autorização;</li>
              <li>Violar os termos de uso das plataformas conectadas (LinkedIn, X, Meta, TikTok).</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-ink">7. Encerramento de conta</h2>
            <p>
              Você pode encerrar sua conta a qualquer momento. Ao encerrar, seus posts,
              marcas e conexões com redes sociais são excluídos, conforme detalhado na
              nossa{' '}
              <Link href="/privacy" className="font-medium text-accent hover:underline">
                Política de Privacidade
              </Link>
              .
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-ink">8. Alterações destes termos</h2>
            <p>
              Podemos atualizar estes termos conforme o produto evolui. Alterações
              relevantes serão comunicadas de forma clara antes de entrarem em vigor.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-ink">9. Contato</h2>
            <p>
              Dúvidas sobre estes termos podem ser enviadas para{' '}
              <a href="mailto:contato@radiokactus.com" className="font-medium text-accent hover:underline">
                contato@radiokactus.com
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </main>
  )
}
