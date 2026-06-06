# POLICY — SocialShelf · Rádio Kactus
**Versão:** 1.1.0
**Data:** 2026-06-06
**Governança:** Engineering Council · `.seeds/ARGUS.md`

---

## 1. Propósito e Escopo

SocialShelf é um SaaS de publicação social para pequenos criadores de conteúdo que gerenciam suas próprias redes. A plataforma permite ao usuário conectar suas contas via OAuth, publicar e agendar conteúdo em múltiplas redes (Instagram, Facebook, LinkedIn, X/Twitter) e monitorar suas publicações, a partir de uma interface web unificada.

Esta política define os princípios operacionais, de engenharia, segurança e experiência que governam todas as decisões técnicas e de produto do sistema. Ela é vinculante para toda contribuição ao repositório.

---

## 2. Princípios de Engenharia

### 2.1 Evolutionary Design
A arquitetura do SocialShelf não é um destino fixo. Cada decisão estrutural deve ser reversível e incremental. Nenhuma mudança estrutural é permitida sem cobertura de testes automatizados prévia.

### 2.2 Responsabilidade Profissional
Código não testado não é código entregue. Pressão de prazo não justifica entrega de código sem testes. A dívida técnica gerada por entregas apressadas custa mais tempo do que o tempo economizado.

### 2.3 Legibilidade como Critério de Qualidade
O código-fonte é um meio de comunicação humana que também é executável por máquinas. A qualidade é medida pela compreensão humana, não pela velocidade de execução. Código que exige esforço para ser compreendido deve ser refatorado antes de receber novas funcionalidades.

### 2.4 TDD como Prática Não Negociável
Toda feature começa com o teste que falha. A testabilidade nativa é um requisito de design, não uma adição posterior.

### 2.5 Inversão de Dependência
Detalhes de infraestrutura (Firebase, Cloud Run, APIs de redes sociais) não governam a política de negócio. As camadas de negócio são independentes e substituíveis.

---

## 3. Política de Segurança

### 3.1 Zero Trust — Negação Implícita
Nenhuma requisição, usuário ou dispositivo é confiável por padrão, independente de origem (interna ou externa). Todo acesso exige autenticação explícita, autorização verificada e avaliação de postura antes de receber privilégio mínimo.

Sessões ativas são verificadas continuamente. Violação de política resulta em encerramento imediato da sessão.

Todo novo serviço ou workload implantado recebe micro-segmentação na camada de aplicação para impedir movimento lateral.

### 3.2 Dados como Passivo — Minimização
Dados do usuário são passivos que aumentam o raio de exposição do sistema, não ativos a serem acumulados. Cada novo dado proposto para coleta deve responder: a utilidade operacional supera o risco de responsabilidade? Se não, é rejeitado.

A política de retenção de dados é o principal determinante da superfície de exposição do sistema.

### 3.3 Transparência Radical
Em caso de vulnerabilidade identificada, a comunicação com os usuários é imediata e direta. Contenção de informação não é uma opção. Soluções de segurança baseadas em caixas-pretas proprietárias são preteridas em favor de protocolos transparentes e verificáveis.

### 3.4 Identidade e Consentimento
Consentimento explícito é pré-requisito estrito para qualquer fluxo de dados do usuário. O sistema aplica minimal disclosure: apenas os atributos estritamente necessários para a operação são solicitados e processados.

Cada serviço integrado (Instagram, Facebook, LinkedIn, X) recebe identificadores pairwise únicos por usuário, impedindo rastreamento cruzado entre plataformas.

Metadados de identidade gerados pelo sistema são criptografados ou descartados, salvo necessidade de segurança explicitamente documentada ou solicitação do usuário.

### 3.5 Compliance como Estado Operacional Contínuo (BAU)
Segurança e conformidade são estados permanentes do sistema, não rituais periódicos. Monitoramento contínuo é integrado aos fluxos de trabalho de desenvolvimento. Toda mudança de sistema dispara validação imediata de impacto de segurança.

A prioridade de risco é definida pela proteção do ciclo de vida dos dados, não por itens de checklist de auditoria.

### 3.6 Fator Humano
Defesas técnicas robustas não eliminam a vulnerabilidade humana. O design de fluxos de autenticação e autorização considera engenharia social, pretexting e colheita de informação como vetores de ataque reais. Treinamento e consciência são parte da postura de segurança.

---

## 4. Política de Experiência do Usuário

### 4.1 Human-Centered Design
Erro do usuário é sintoma de design deficiente, não de falha do operador. O sistema é redesenhado para acomodar o comportamento observado. Toda ação possível no sistema possui affordance sinalizada por signifier claro e perceptível. Toda mudança de estado gera feedback imediato e inequívoco.

### 4.2 Usabilidade Empírica
Funcionalidade não validada por observação direta de usuários reais é considerada tecnicamente nula até prova empírica. Conflito entre inovação estética e padrão de usabilidade estabelecido é resolvido em favor do padrão. O sistema não exige que o usuário memorize informações entre telas.

### 4.3 Information Architecture — Findability First
Findability é o pré-requisito cardinal de utilidade: um recurso que não pode ser encontrado não pode ser usado. A arquitetura de informação é verificada antes de qualquer refinamento estético. Aumento de densidade de informação requer aplicação de classificação facetada e esquemas de metadados. Conflito entre redução estética e wayfinding é resolvido em favor da affordance navegacional.

---

## 5. Política de Dados e Privacidade

| Dimensão | Posição |
|---|---|
| Coleta | Mínima — apenas o estritamente necessário para a operação |
| Retenção | O menor período operacionalmente viável |
| Compartilhamento | Nunca sem consentimento explícito e propósito declarado |
| Identificadores | Pairwise por serviço; nenhum ID global permanente |
| Tokens OAuth | Armazenados criptografados; escopo mínimo solicitado |
| Logs | Sem dados pessoais identificáveis; retenção limitada |
| Vulnerabilidades | Comunicação imediata e transparente aos usuários afetados |

---

## 6. Política de Integração com Redes Sociais

As integrações com Instagram, Facebook, LinkedIn e X/Twitter seguem **exclusivamente o modelo OAuth delegado** pela própria plataforma. O sistema **nunca armazena credenciais** (login e senha) dos usuários em nenhuma rede social. O fluxo de autorização ocorre inteiramente via redirect OAuth da plataforma de destino.

- **OAuth exclusivo:** credenciais de redes sociais jamais transitam ou são armazenadas pelo SocialShelf. Qualquer proposta de armazenamento de senha de rede social é rejeitada sem deliberação.
- **Escopo mínimo:** apenas as permissões estritamente necessárias para publicação são solicitadas.
- **Tokens por marca:** cada produto/marca gerenciado usa credenciais isoladas.
- **Revogação:** o usuário pode revogar o acesso de qualquer rede a qualquer momento, com efeito imediato no sistema.
- **Auditoria:** toda publicação é registrada com timestamp, usuário, produto e rede de destino.
- **Falha explícita:** erro de publicação gera notificação imediata; o sistema não silencia falhas.

---

## 7. Política de Arquitetura e Infraestrutura

- **Firebase** é tratado como detalhe de infraestrutura; a lógica de negócio não depende diretamente do SDK Firebase.
- **Cloud Run** provê isolamento de workload; cada serviço é micro-segmentado.
- **Deploy** não é considerado entregue sem validação de impacto de segurança.
- **Mudança estrutural** sem cobertura de testes automatizados é bloqueada.
- **Complexidade de performance** é isolada e documentada extensivamente quando inevitável.

---

## 8. Vocabulário Proibido

As seguintes expressões são proibidas em qualquer artefato deste projeto — código, documentação, PRs, comentários, issues:

> hack · workaround · ad-hoc · quick-fix · depois arrumamos · good enough
> obfuscation · user error · blame · aesthetic-first · inviolável
> solução definitiva · confiança implícita · zona segura · big design up front
> manual regression · premature optimization · dados como ativo
> rede confiável · usuário interno · segurança de perímetro

---

## 9. Hierarquia de Resolução de Conflitos

Quando princípios desta política se contradizem em uma decisão específica:

1. Correção lógica formal
2. Segurança estrutural (Zero Trust)
3. Proteção de dados e identidade (IAM)
4. Testabilidade e qualidade
5. Sustentabilidade arquitetural
6. Compliance contínuo
7. Minimização de superfície
8. Fator humano e ataque
9. Findability e Information Architecture
10. Ergonomia cognitiva
11. Usabilidade empírica

---

## 10. Governança deste Documento

Esta política é derivada das seeds de governança em `.seeds/` e validada pelo `ARGUS.md`. Alterações a este documento seguem o mesmo processo de qualquer decisão estrutural (TIPO 4): requerem validação sequencial das seeds ativas antes de merge.

Revisão obrigatória a cada mudança de sprint ou alteração de escopo do produto.
