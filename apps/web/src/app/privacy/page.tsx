import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Política de Privacidade — SocialShelf',
  description: 'Política de privacidade do SocialShelf',
}

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-bg px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <Link href="/" className="text-sm font-medium text-accent hover:underline">
          ← SocialShelf
        </Link>

        <h1 className="mb-2 mt-6 text-3xl font-bold text-ink">Política de Privacidade</h1>
        <p className="mb-8 text-sm text-muted">Última atualização: 6 de julho de 2026</p>

        <div className="space-y-8 text-ink/90">
          <section>
            <h2 className="mb-2 text-lg font-semibold text-ink">1. Quem trata os seus dados</h2>
            <p>
              O SocialShelf é operado por <strong>Rádio Kactus</strong>
              {' '}(CNPJ a ser incluído nesta página assim que o registro formal da empresa
              for concluído), controladora dos dados pessoais tratados nesta política,
              nos termos da Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018).
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-ink">2. Princípio de minimização</h2>
            <p>
              Tratamos dados como um passivo, não um ativo: só coletamos o que é
              estritamente necessário para operar o serviço, retemos pelo menor prazo
              operacionalmente viável e nunca guardamos dados &ldquo;por precaução&rdquo;
              para uso futuro indefinido.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-ink">3. Dados que coletamos</h2>
            <ul className="ml-5 mt-2 list-disc space-y-2">
              <li>
                <strong>Cadastro:</strong> nome, e-mail e senha (ou login via Google),
                usados para autenticação na conta.
              </li>
              <li>
                <strong>Conexões com redes sociais:</strong> ao conectar uma rede social
                via OAuth, armazenamos um identificador específico daquela plataforma
                (nunca compartilhado entre plataformas) e uma referência criptografada
                ao token de acesso — nunca a sua senha da rede social.
              </li>
              <li>
                <strong>Conteúdo de marca:</strong> informações que você fornece sobre
                seu negócio ou marca, usadas para gerar conteúdo alinhado à sua voz.
              </li>
              <li>
                <strong>Posts e mídia:</strong> textos, imagens, áudios e vídeos criados
                ou enviados por você para publicação.
              </li>
              <li>
                <strong>Sinal de audiência:</strong> métricas agregadas de desempenho dos
                seus posts publicados (visualizações, curtidas, engajamento), quando a
                rede social conectada disponibiliza esse dado.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-ink">4. O que nunca coletamos</h2>
            <ul className="ml-5 mt-2 list-disc space-y-1">
              <li>Login e senha das suas redes sociais;</li>
              <li>Mensagens diretas, comentários ou dados de terceiros nas redes conectadas;</li>
              <li>Identificadores globais que cruzem sua identidade entre plataformas diferentes.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-ink">5. Como protegemos os seus dados</h2>
            <ul className="ml-5 mt-2 list-disc space-y-1">
              <li>Tokens de acesso às redes sociais são criptografados (AES-256-GCM) e armazenados em cofre dedicado, nunca em texto claro;</li>
              <li>Acesso a dados segue o princípio de negação implícita (zero trust) em todas as camadas;</li>
              <li>Nossos registros técnicos (logs) nunca contêm e-mail, nome, senha ou conteúdo de posts.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-ink">6. Por quanto tempo guardamos seus dados</h2>
            <table className="mt-2 w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-line text-left text-muted">
                  <th className="py-2 pr-4 font-medium">Dado</th>
                  <th className="py-2 font-medium">Retenção</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                <tr>
                  <td className="py-2 pr-4">Conexão com rede social</td>
                  <td className="py-2">Até você desconectar ou revogar o acesso</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Posts e marcas</td>
                  <td className="py-2">Enquanto sua conta estiver ativa</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Arquivos enviados por você (upload de vídeo)</td>
                  <td className="py-2">7 dias após a publicação, com opção de download nesse período</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Dados de sessão</td>
                  <td className="py-2">Duração da sessão de login</td>
                </tr>
              </tbody>
            </table>
            <p className="mt-3">
              Ao excluir sua conta, seus posts, conexões e conteúdo de marca são
              apagados. Essa é uma operação de rotina do sistema, não uma exceção.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-ink">7. Compartilhamento de dados</h2>
            <p>
              Não compartilhamos seus dados com terceiros para fins de marketing.
              Seus dados são processados por:
            </p>
            <ul className="ml-5 mt-2 list-disc space-y-1">
              <li>Provedores de infraestrutura em nuvem (Google Cloud Platform), para hospedagem e processamento;</li>
              <li>As redes sociais que você conecta, apenas para executar a publicação que você solicitou;</li>
              <li>Provedores de inteligência artificial (Google Vertex AI / Gemini), para gerar textos, imagens, áudio e vídeo a partir do que você solicita.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-ink">8. Seus direitos (LGPD)</h2>
            <p>Você pode, a qualquer momento:</p>
            <ul className="ml-5 mt-2 list-disc space-y-1">
              <li>Confirmar a existência de tratamento e acessar seus dados;</li>
              <li>Corrigir dados incompletos, inexatos ou desatualizados;</li>
              <li>Solicitar a exclusão dos seus dados e da sua conta;</li>
              <li>Revogar o consentimento e desconectar qualquer rede social a qualquer momento;</li>
              <li>Solicitar a portabilidade dos seus dados a outro fornecedor.</li>
            </ul>
            <p className="mt-2">
              Para exercer qualquer um desses direitos, entre em contato pelo canal
              indicado na seção 10.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-ink">9. Em caso de incidente de segurança</h2>
            <p>
              Se identificarmos um incidente que exponha dados pessoais, a comunicação
              com os usuários afetados é imediata e direta, sem retenção de informação
              sobre o ocorrido.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-ink">10. Contato</h2>
            <p>
              Dúvidas sobre esta política ou solicitações relacionadas aos seus dados
              podem ser enviadas para{' '}
              <a href="mailto:contato@socialshelf.com.br" className="font-medium text-accent hover:underline">
                contato@socialshelf.com.br
              </a>
              .
            </p>
          </section>

          <section>
            <p className="text-sm text-muted">
              Consulte também nossos{' '}
              <Link href="/terms" className="font-medium text-accent hover:underline">
                Termos de Uso
              </Link>
              .
            </p>
          </section>
        </div>
      </div>
    </main>
  )
}
