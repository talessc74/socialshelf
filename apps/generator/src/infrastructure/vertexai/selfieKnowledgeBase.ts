// Base de conhecimento do produto usada no prompt do Selfie (_local-adr-policy-045) — texto
// fixo escrito à mão, não busca semântica sobre documentação. Mesmo conteúdo-base da página
// /dashboard/manual (apps/web/src/app/dashboard/manual/page.tsx, _local-bdr-policy-015) —
// mantido em sincronia manualmente entre os dois arquivos, mesmo padrão já usado em
// PlanLimits.ts/plans/page.tsx.
export const SELFIE_KNOWLEDGE_BASE = `
# O que é o SocialShelf
SocialShelf é uma plataforma que ajuda a criar, agendar e publicar conteúdo em redes sociais
com apoio de inteligência artificial, e a acompanhar o desempenho dos posts já publicados.

# Menu principal (dentro de /dashboard)
- Início: painel geral com um resumo da marca.
- Notícias: sugestões de pautas/notícias para gerar conteúdo.
- Gerar com IA: cria posts (texto e imagem) com inteligência artificial.
- Novo Post: cria um post manualmente, sem IA.
- Campanhas: conjuntos de posts organizados por tema/campanha.
- Agendados: posts já programados para publicar em data futura.
- Insights: sugestões e análises sobre o que postar.
- Performance: métricas reais dos posts já publicados (impressões, engajamento) por rede.
- Contas (Central de Contas): conectar e gerenciar as redes sociais da marca.
- Marca: configurações da marca (perfil, limites, preferências).
- Meus Gastos de IA: saldo de créditos de IA do plano do usuário.
- Assinatura: plano atual e opções de upgrade.
- Manual: página de ajuda navegável com todo o conteúdo deste guia (pré-requisitos, como
  conectar cada rede, como confirmar conexão, como criar o primeiro post, problemas comuns,
  créditos de IA) — é essa mesma base de conhecimento, só que como página pra ler. Se alguém
  perguntar por um manual, guia ou documentação do site, a resposta é apontar pra essa página,
  nunca dizer que não existe.

# Como conectar cada rede social (tudo em Central de Contas)
- Instagram e Facebook andam juntos, mas há duas formas de conectar o Instagram:
  1. Com Facebook (conecta os dois de uma vez): botão "Conectar" no card do Facebook OU do
     Instagram. Login na Meta/Facebook, escolhe a Página (se tiver mais de uma); se essa
     Página tiver uma conta Instagram profissional vinculada, o Instagram conecta junto.
  2. Só o Instagram, sem Facebook: botão "Conectar sem Facebook" no card do Instagram — login
     direto na conta profissional do Instagram, sem precisar de Página nem conta do Facebook.
- Pré-requisito do Instagram: a conta precisa ser profissional (Business ou Creator) — um
  perfil pessoal não pode ser conectado. Para converter: no app do Instagram,
  Configurações → Tipo de conta e ferramentas → Mudar para conta profissional (grátis).
- Pré-requisito do Facebook: é preciso administrar pelo menos uma Página do Facebook.
- LinkedIn: duas conexões independentes — "Conectar" (perfil pessoal) e "Conectar Página do
  LinkedIn" (uma Página de empresa administrada pelo usuário). Pode usar as duas.
- X (antigo Twitter) e TikTok: um clique em "Conectar", login, autorizar.

# Antes de conectar — pré-requisitos de cada rede (exigência da própria rede, não do SocialShelf)
- Instagram: só conecta se a conta for profissional (Business ou Creator) — perfil pessoal não funciona.
- Facebook: precisa administrar pelo menos uma Página (perfil pessoal sozinho não vale).
- LinkedIn: perfil pessoal ou Página de empresa administrada — caminhos independentes.
- X e TikTok: basta ter uma conta normal, sem pré-requisito adicional.

# Como saber que a conexão funcionou
Depois de autorizar, volta pra Central de Contas automaticamente. Dois sinais confirmam:
uma faixa verde "Conectado com sucesso" no topo, e o card da rede mostrando "● Conectado"
com o nome da conta logo abaixo. Faixa vermelha em vez da verde = algo impediu a conexão.

# Problemas comuns de conexão e como resolver
- Erro de token expirado / "sessão expirou" / conexão perdeu permissão: toda conexão tem
  prazo de validade. A solução é voltar em Central de Contas e clicar em "Reconectar" no
  card daquela rede — mesmo processo de conectar pela primeira vez.
- "Nenhuma Página do Facebook encontrada": a conta logou certo, mas não administra nenhuma
  Página do Facebook. Precisa criar uma Página (grátis) antes de conectar.
- "Nenhuma Página do LinkedIn administrada foi encontrada": só acontece ao usar "Conectar
  Página do LinkedIn" sem administrar nenhuma Página de empresa — usar o botão "Conectar"
  normal conecta o perfil pessoal em vez disso.
- Facebook conectou mas o Instagram não: a Página escolhida não tem conta profissional do
  Instagram vinculada a ela — precisa vincular isso nas configurações do Facebook e reconectar.
- Métricas do Facebook não aparecem mesmo com a conexão saudável: a Meta só libera dados de
  Performance para Páginas com pelo menos 100 seguidores — não é problema de conexão,
  reconectar não resolve; é preciso continuar publicando até a Página crescer.
- "Falha ao conectar plataforma. Tente novamente": erro genérico, geralmente temporário —
  tentar de novo resolve a maioria dos casos.

# Criando o primeiro post
1. Ir em "Gerar com IA" (ou "Novo Post" pra escrever do zero, sem IA).
2. Descrever o que quer postar, ou escolher uma sugestão em Notícias ou Insights.
3. Revisar o texto e a imagem gerados — dá pra editar à vontade antes de publicar.
4. Escolher publicar agora ou agendar pra uma data/hora futura.
5. Publicando agora, vai direto pras redes conectadas; agendando, fica visível em
   "Agendados" até a hora chegar. Depois de publicado, acompanhar o resultado em "Performance".

# Créditos de IA
- Cada plano inclui um saldo mensal de créditos de IA, que reseta todo mês (sem acúmulo do
  mês anterior — "usa ou perde").
- É possível comprar créditos avulsos, que nunca expiram e só são usados depois que o saldo
  do plano do mês acabar.
- O saldo atual aparece em "Meus Gastos de IA" no menu.
`.trim()
