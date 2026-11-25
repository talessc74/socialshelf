---
name: _local-bdr-policy-016-guia-de-onboarding-e-revisao-de-cadastros
description: Define um documento público (/comece-aqui) pra explicar a um prospect, antes de assinar, o que funciona na hora e o que depende de liberação manual como testador do Instagram/Facebook — e uma página de admin (/dashboard/admin/signups) que substitui notificação por e-mail/Slack por uma lista de conferência manual. Use ao mexer em onboarding de prospect, no fluxo de liberação manual como testador da Meta, ou nas rotas /admin/signups.
apply-to: apps/web (/comece-aqui, /dashboard/admin/signups), apps/api (rotas /admin/signups, FirestoreMetaTesterChecklistRepository)
valid-from: 2026-11-25
---

# _local-bdr-policy-016: Guia de Onboarding e Revisão de Cadastros

## Context and Problem Statement

`_local-bdr-policy-012` já documenta que, enquanto o app da Meta não passa por App Review,
só contas cadastradas manualmente como testadoras conseguem publicar via Instagram/Facebook —
e que esse cadastro é um processo de dois passos (admin adiciona como Tester; a pessoa aceita o
convite pelo próprio Instagram). O que faltava: (1) nenhum material explicava isso a um
prospect *antes* de ele criar conta — a única forma de descobrir a exigência era tentar
conectar e esbarrar no erro; e (2) o admin não tinha como saber que um cadastro novo esperava
essa liberação, a não ser abrindo o Firestore à mão.

## Decision Outcome

**Duas peças, sem infraestrutura de e-mail/Slack nova**: uma página pública
(`/comece-aqui`) que explica o processo completo a quem ainda não é assinante, e uma página de
admin (`/dashboard/admin/signups`) que lista cadastros e se já foram liberados manualmente —
conferida pelo admin quando ele quiser, em vez de um aviso em tempo real.

### Details

**Por que uma página pública, não um PDF**

Decisão explícita do usuário: o documento é pra ser mandado *antes* do cadastro (ex. por
WhatsApp/e-mail), então precisa de um link, não de um anexo — mais fácil de manter atualizado
sem regenerar um arquivo. Segue o mesmo padrão de `apps/web/src/app/privacy/page.tsx` e
`terms/page.tsx` (página pública, fora do login, server component com `metadata`), não o padrão
do Guia Visual em PDF (`_local-bdr-policy-015`), que é outro documento pra outro público.

**Por que não é notificação por e-mail/Slack**

Investigação confirmou que o projeto não tem nenhuma infraestrutura de e-mail/Slack hoje —
monta-la só pra este aviso seria desproporcional. Decisão explícita do usuário: uma página de
admin que ele confere quando quiser é suficiente, sem precisar configurar um provedor novo
(SendGrid/Resend) nem um webhook.

**Como a lista de cadastros é montada**

Não existe hoje um evento explícito de "o usuário quer conectar Instagram" — o cadastro não
pergunta qual rede a pessoa pretende usar. Em vez de tentar inferir isso, a página lista *todo*
usuário, usando a marca mais antiga de cada um (`BrandRepository.findAll()`, agrupado por
`userId`) como aproximação de "data de entrada" — todo usuário ganha uma marca default no
primeiro login. O e-mail vem do Firebase Auth (`adminAuth.getUsers`, em lote), não é guardado
duplicado em lugar nenhum.

**Por que o estado "já liberado" não é um domain port**

`FirestoreMetaTesterChecklistRepository` (`apps/api/src/infrastructure/firestore/`) é uma
classe concreta direta, sem port em `packages/domain` — é bookkeeping puramente operacional do
admin (um checkbox persistido), sem significado de negócio substituível entre serviços; nem
generator nem publisher precisam ler isto. Mesmo racional já usado pro cliente do Stripe
(`_local-bdr-policy-013`): "Ports existem para coisas com significado de negócio substituível,
não pra todo SDK/bookkeeping."

Documento em `users/{userId}/meta_tester_review/status` (singleton, mesmo padrão de
`subscription`/`credits`), regra do Firestore `allow read, write: if false` (só o api-service,
via Admin SDK, toca nisso — mesmo tratamento de `processed_credit_purchases`).

**Marcar como liberado não libera nada automaticamente**

A rota `POST /admin/signups/:userId/handled` só grava um checkbox — o cadastro real como
Tester continua manual, no painel da própria Meta (fora do SocialShelf). A página deixa isso
explícito pro admin não confundir "marquei aqui" com "já libere de verdade".

**Sem link nenhum pra `/comece-aqui` dentro do produto**

É uma página pra mandar diretamente (URL), não pra descobrir navegando pelo site — por isso não
tem link no `TopNav` nem na home. Mesmo espírito de `/dashboard/admin/ai-usage`
(`_local-edr-policy-072`): a página de admin também não tem link na UI, só o gate real no
backend (`requireAdmin`).

## What this does not solve

Não acelera o App Review nem monta automação de verdade (ex. API da Meta pra automatizar o
cadastro de Tester) — ambos fora do escopo de engenharia, já documentado na BDR-012. Também não
cobre um prazo de SLA formal — "normalmente até 1 dia útil", citado na página pública, é uma
expectativa razoável, não uma garantia contratual.

## Atualização 2026-11-25 — links reais e diagramas por ícone, sem screenshot

Usuário apontou que a primeira versão só descrevia os passos em texto, sem link nenhum pra
clicar e sem nada visual — pediu capturas de tela e links de acesso nas três frentes
(`/comece-aqui`, `/dashboard/admin/signups`, e o próprio documento que vai pro usuário novo,
que é a mesma página).

**Por que não são screenshots reais do Instagram/Meta**: não temos login nessas contas pra
capturar a tela de verdade, e a interface deles muda com frequência — um screenshot
desatualizado confunde mais do que ajuda, e recriar a UI deles em pixel não é um objetivo em si.
Resolvido com **diagramas por ícone** (`StepCard`, `lucide-react`: `UserCheck`/`Mail`/
`Smartphone`/`ShieldCheck`) por passo, mais visual que a lista numerada anterior sem depender de
reproduzir a interface de terceiros.

**Links reais adicionados em `/comece-aqui`**: `/signup` (já existia), `instagram.com` e
`facebook.com` (abrir o app/site de cada rede), o artigo oficial do Instagram sobre conta
profissional (`help.instagram.com/502981923235522`) e a documentação oficial da Meta sobre
papéis de app (`developers.facebook.com/docs/development/build-and-test/app-roles`) — os dois
últimos vieram de busca na web, não foram confirmados por fetch direto (rede do ambiente de
sessão bloqueou o host); replicáveis, mas vale checar manualmente se ainda resolvem antes de um
próximo ciclo de revisão desta página. Reafirmado também, nesta página (antes só estava no
Manual), que o Instagram exige conta profissional (Business/Creator), não pessoal.

**Link real adicionado em `/dashboard/admin/signups`**: botão pra `developers.facebook.com/apps/`
("Minhas Apps" da Meta) — não dá pra linkar direto pra tela de Roles/Testers de um app
específico sem o App ID, que é segredo (`META_APP_ID`) e não é lido nesta página; o admin clica,
escolhe o app do SocialShelf e navega até Funções do app > Testadores a partir daí.

**Por que não um PDF separado**: CSS de impressão (`print:`) foi adicionado direto em
`/comece-aqui` — "Salvar como PDF" do navegador já produz um arquivo limpo (esconde nav/botões,
mantém o conteúdo), sem precisar duplicar o pipeline Playwright+pikepdf do Guia Visual
(`_local-bdr-policy-015`), que é pra outro documento com outro objetivo (marca impressa,
proteção de cópia). Se o usuário quiser um PDF baixável de verdade depois, é extensão natural
desta BDR, não uma nova decisão.

## Conflicts

Nenhum identificado. Implementa, em cima de `_local-bdr-policy-012`, as duas pontas que faltavam
(material pro prospect, visibilidade pro admin) sem alterar nenhuma decisão anterior.

## References

- [_local-bdr-policy-012-onboarding-meta-em-modo-de-desenvolvimento](012-onboarding-meta-em-modo-de-desenvolvimento.md) - A decisão de produto que esta BDR implementa visibilidade para (allowlist manual, dois passos de Tester)
- [_local-bdr-policy-015-manual-navegavel-do-produto](015-manual-navegavel.md) - Outro documento de ajuda do produto — para usuário já logado, não para prospect
- `apps/web/src/app/comece-aqui/page.tsx` - Página pública de onboarding
- `apps/web/src/app/dashboard/admin/signups/page.tsx` - Página de admin, lista de conferência manual
- `apps/api/src/infrastructure/firestore/FirestoreMetaTesterChecklistRepository.ts` - Checklist persistido, sem domain port
