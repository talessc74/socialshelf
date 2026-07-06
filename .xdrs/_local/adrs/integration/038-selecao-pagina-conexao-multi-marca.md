---
name: _local-adr-policy-038-selecao-de-pagina-conexao-multi-marca
description: Define como o fluxo de conexão OAuth seleciona qual página/conta de cada plataforma fica vinculada a cada marca, e a limitação conhecida do X para múltiplas contas. Use ao implementar ou revisar o fluxo de conexão de marca.
apply-to: Fluxo de conexão OAuth por marca (apps/api use-cases de oauth, tela de conexão em apps/web)
valid-from: 2026-06-26
---

# _local-adr-policy-038: Seleção de Página — Conexão Multi-Marca

## Context and Problem Statement

`_local-bdr-policy-009` assume um cenário de administrador/agência com várias marcas profissionais, cada uma conectada à conta social de um cliente diferente. `_local-adr-policy-009` já isola tokens por `(brandId, platform)`, mas não define como o usuário escolhe, no momento da conexão, qual página/conta da plataforma corresponde a qual marca quando o mesmo login pessoal do administrador tem acesso a várias.

LinkedIn e Meta permitem que um único login pessoal administre múltiplas Páginas/Organizações — a API retorna a lista completa sob um token. X (Twitter) autentica uma conta por vez; não existe conceito de "páginas administradas" sob um único login.

Como o fluxo de conexão deve se comportar para que o administrador vincule a conta certa à marca certa, em cada plataforma, sem ambiguidade?

## Decision Outcome

**Para LinkedIn e Meta, o callback OAuth lista as páginas/organizações disponíveis no token e exige seleção explícita antes de persistir a `OAuthConnection`. Para X, a tela de conexão avisa explicitamente que a conta ativa no navegador no momento da autorização é a que será vinculada.**

### Details

**LinkedIn e Meta (Instagram/Facebook)**

- `HandleLinkedInCallbackUseCase` e `HandleMetaCallbackUseCase` passam a, após obter o token, consultar a lista de organizações/páginas administradas pelo usuário autenticado.
- Se a lista tiver mais de um item, o fluxo não persiste a `OAuthConnection` imediatamente — retorna a lista para a interface, que exibe uma etapa de seleção ("qual página representa esta marca?") antes de concluir a conexão.
- Se a lista tiver exatamente um item, a seleção é automática (comportamento atual preservado para o caso de uso de hoje, sem fricção extra).

**X (Twitter)**

- Não há lista de contas para selecionar — o token obtido corresponde à conta logada no navegador no momento da autorização.
- A tela de conexão de marca exibe aviso antes de iniciar o fluxo OAuth do X: a conta logada no momento é a que ficará vinculada a esta marca; para conectar outra conta X a outra marca, é necessário trocar a sessão logada no X antes de repetir o processo.
- Esta é uma limitação reconhecida da plataforma, não do SocialShelf — não há solução técnica do lado do SocialShelf para eliminar essa fricção.

**Mudança de modelo de dados (correção em relação à decisão original)**

- `OAuthConnection` ganha o campo opcional `organizationUrn: string | null`. Sem ele,
  não há como o `LinkedInPublisher`/`MetaPublisher` saber se deve publicar como a
  página/organização selecionada ou como o perfil pessoal do token — a omissão original
  desta decisão causou um bug real em produção (post publicado no perfil pessoal em vez
  da página da marca). `(brandId, platform)` continua sendo o isolamento de credenciais
  (`_local-adr-policy-009`, `_local-adr-policy-017`); `organizationUrn` é apenas o destino
  de publicação dentro dessa credencial.

### 2026-06-26 — implementação parcial: LinkedIn

- `buildLinkedInAuthUrl` passa a solicitar os scopes `r_organization_admin` e
  `w_organization_social`, além dos já existentes.
- `listAdministeredOrganizations` (novo, em `apps/api/src/lib/linkedin-client.ts`) consulta
  `/v2/organizationAcls?q=roleAssignee&role=ADMINISTRATOR` para obter as páginas
  administradas pelo token.
- `HandleLinkedInCallbackUseCase`: 0 páginas → `organizationUrn = null` (publica como
  perfil pessoal, comportamento anterior preservado); exatamente 1 página → seleção
  automática (`organizationUrn` preenchido); mais de 1 página → lança
  `linkedin_multiple_organizations`, e o callback redireciona com
  `?error=linkedin_multiple_organizations`.
- `LinkedInPublisher.publish`: usa `connection.organizationUrn` como `author` quando
  presente; caso contrário, mantém o fallback para `urn:li:person:${personId}` via
  `/v2/userinfo`.
- **Pendência conhecida**: o caso de mais de uma página administrada ainda não tem UI de
  seleção em `apps/web` — hoje apenas falha com um código de erro específico, sem
  fricção elegante. A etapa de seleção explícita descrita nesta decisão permanece como
  trabalho futuro para esse caso.
- Meta (Instagram/Facebook) ainda não foi implementado — mesma lacuna se aplica a
  `MetaPublisher`, que continua publicando apenas no destino derivado do token, sem
  seleção de página.

### 2026-06-26 — reversão: bloqueio de produto no LinkedIn Developer Portal

- Ao tentar usar a implementação acima em produção, o fluxo de reconexão do LinkedIn
  passou a falhar com uma tela de erro genérica do próprio LinkedIn (antes de qualquer
  redirect para o SocialShelf) — o LinkedIn estava rejeitando a autorização inteira.
- Causa raiz identificada: os escopos `r_organization_admin` e `w_organization_social`
  pertencem ao produto **"Community Management API"** do LinkedIn Developer Portal, que
  não vem habilitado por padrão e precisa ser solicitado e aprovado pelo LinkedIn.
- Ao tentar solicitar o produto no app existente do SocialShelf, o LinkedIn recusou com:
  *"This API product requires that it be the only product on the application for legal
  and security reasons. This product cannot be requested because there are currently
  other provisioned products."* — o app já tem "Share on LinkedIn" e "Sign In with
  LinkedIn using OpenID Connect" provisionados, que sustentam login e publicação no
  perfil pessoal hoje.
- **Isso é uma restrição estrutural do LinkedIn, não uma aprovação pendente**: não é
  possível ter Community Management API coexistindo com os produtos atuais no mesmo app.
  A única forma de obter publicação em página de empresa seria criar um **segundo app**
  no LinkedIn Developer Portal dedicado exclusivamente a esse produto, com client
  ID/secret próprios — exigindo o SocialShelf gerenciar dois fluxos OAuth distintos para
  LinkedIn (um app para perfil pessoal/login, outro para páginas de empresa).
- Decisão (revertida nesta data): os escopos `r_organization_admin`/`w_organization_social`
  e a chamada a `listAdministeredOrganizations` foram revertidos em
  `buildLinkedInAuthUrl` e `HandleLinkedInCallbackUseCase`. `organizationUrn` permanece
  sempre `null` para novas conexões LinkedIn até uma decisão sobre o app dedicado. O
  fallback em `LinkedInPublisher.publish` (usar `organizationUrn` quando presente,
  perfil pessoal quando ausente) foi mantido — é inofensivo e não exige reversão, já que
  nenhuma conexão terá `organizationUrn` preenchido por ora.
- **Publicação em página de empresa do LinkedIn permanece sem solução até decisão
  explícita sobre criar e manter um segundo app LinkedIn** dedicado ao Community
  Management API.

### 2026-06-27 — bug correlato: `apps/publisher` publicava (ou falhava) na marca/conta errada por confundir `userId` com `brandId`

- Sintoma relatado: SocialShelf exibia "Publicado com sucesso: ✓ LinkedIn" para um post da marca
  "EAI? Jurídico" sem nada aparecer de fato publicado nessa conta.
- Causa raiz: `apps/api/src/routes/posts.routes.ts` (`POST /posts/:id/publish`) só enviava
  `postId` e `brandId` no corpo da chamada interna para `apps/publisher` — nunca o `userId` real
  do dono da marca. `PublishPostUseCase.execute` (em `apps/publisher`), sem ter o `userId` real
  disponível, usava `brandId` no lugar de `userId` tanto em `postRepo.findByIdAndBrand(postId,
  brandId, brandId)` quanto em `oauthRepo.findByBrandAndPlatform(brandId, brandId, platform)`.
  Como os caminhos no Firestore são `users/{userId}/brands/{brandId}/...`, essas chamadas liam
  (ou gravavam status em) `users/{brandId}/brands/{brandId}/...` — um caminho incorreto sempre
  que `userId !== brandId`, exatamente o cenário de agência com múltiplas marcas profissionais
  descrito em `_local-bdr-policy-009` e nesta própria decisão. Em contas de marca única onde
  `brandId` coincide com o `userId`, o bug ficava mascarado.
- Correção: `userId` passa a ser enviado por `posts.routes.ts` no corpo da chamada interna;
  `PublishPostUseCase.execute` ganha o parâmetro `userId` e usa o par real `(userId, brandId)`
  nas duas consultas; `ScheduledPostsPoller` passa `post.userId` (já disponível no `Post`
  carregado); a rota `/publish` em `apps/publisher` valida `userId` no corpo da requisição.
- Esta correção é ortogonal à seleção de página descrita nesta ADR (aquela trata de qual
  página/organização vincular na conexão; esta trata de qual marca/usuário é resolvido no
  momento da publicação) — registrada aqui por afetar o mesmo cenário multi-marca.

### 2026-06-27 — correção: reversão de 2026-06-26 estava incompleta, causou regressão em produção

- A reversão registrada em 2026-06-26 só atingiu `HandleLinkedInCallbackUseCase` (e seu teste) —
  o commit squash daquela PR nunca tocou `apps/api/src/lib/linkedin-client.ts`, confirmado via
  `git show <commit> --stat`. O scopo bloqueado pelo LinkedIn (`r_organization_admin
  w_organization_social`) permaneceu em `buildLinkedInAuthUrl`, fazendo o LinkedIn voltar a
  rejeitar a autorização inteira com a tela genérica de erro — a mesma falha que a reversão
  deveria ter eliminado, agora reaparecendo em produção em toda tentativa de (re)conexão.
- Não havia teste dedicado para o `scope` retornado por `buildLinkedInAuthUrl`
  (`linkedin-client.test.ts` não existe), o que permitiu a reversão incompleta passar
  pela suíte de testes sem ser detectada.
- Correção: `buildLinkedInAuthUrl` volta a usar `scope: 'openid profile email w_member_social'`;
  `listAdministeredOrganizations` e a interface `LinkedInOrganization` foram removidas de
  `linkedin-client.ts` (código morto, nada mais os referenciava); o branch de erro
  `linkedin_multiple_organizations` em `linkedin.routes.ts` foi removido (inalcançável, já que
  `HandleLinkedInCallbackUseCase` nunca lança esse erro); o mock obsoleto de
  `listAdministeredOrganizations` em `linkedin.routes.test.ts` foi removido.
- Verificado via `git show`/`git diff` no commit efetivamente enviado (não apenas na árvore de
  trabalho local) que o diff cobre exatamente os três arquivos pretendidos, evitando repetir o
  erro do commit anterior, que divergiu da mensagem de commit declarada.

### 2026-06-27 — implementação: segundo app LinkedIn dedicado, com UI de seleção multi-página

- Decisão tomada: criar um **segundo app no LinkedIn Developer Portal**, exclusivo para o
  produto Community Management API, em vez de tentar reaproveitar o app pessoal/login já
  existente (bloqueado desde a reversão de 2026-06-26). O app pessoal continua respondendo
  por `openid profile email w_member_social` (perfil pessoal); o novo app responde só por
  `r_organization_admin w_organization_social` (Páginas de empresa).
- Escopo confirmado com o usuário antes da implementação: só o owner do SocialShelf cria e
  mantém o app no Developer Portal — usuários finais nunca acessam o Developer Portal, apenas
  autorizam via OAuth padrão. Ressalva registrada: a API de Community Management normalmente
  libera publicação só nas Páginas associadas/verificadas pelo próprio app na aprovação
  inicial; publicar em Páginas de terceiros (clientes do SaaS) tende a exigir uma revisão
  adicional da LinkedIn além da aprovação inicial do produto. O código abaixo já é
  multi-tenant por construção — a limitação adicional, se houver, é inteiramente do lado da
  aprovação da LinkedIn, não do SocialShelf.
- Novo fluxo, paralelo e independente do fluxo de perfil pessoal:
  - `apps/api/src/lib/linkedin-page-client.ts` (novo): `buildLinkedInPageAuthUrl`,
    `exchangeCodeForPageToken`, `listAdministeredOrganizations` — usam
    `LINKEDIN_PAGE_CLIENT_ID`/`LINKEDIN_PAGE_CLIENT_SECRET`/`LINKEDIN_PAGE_REDIRECT_URI`
    (novas env vars, distintas de `LINKEDIN_CLIENT_ID` etc.).
  - `GenerateLinkedInPageAuthUrlUseCase`, `HandleLinkedInPageCallbackUseCase`,
    `GetPendingLinkedInPageSelectionUseCase`, `ConfirmLinkedInPageSelectionUseCase` (novos,
    em `apps/api/src/use-cases/oauth/`): 0 páginas → erro `linkedin_no_organizations`; 1
    página → seleção automática, persiste direto; mais de 1 página → guarda o token
    temporariamente em `FirestoreTokenVault` sob a chave `linkedin-page-pending-{pendingId}`
    (TTL de 10 minutos, mesmo padrão do `csrf.ts`) e devolve a lista para a interface
    escolher; a escolha confirma via endpoint dedicado, que persiste a `OAuthConnection` e
    apaga a entrada pendente do vault.
  - Rotas novas em `apps/api/src/routes/oauth/linkedin-page.routes.ts`:
    `GET /oauth/linkedin-page/authorize`, `GET /oauth/linkedin-page/callback`,
    `GET /oauth/linkedin-page/pending/:pendingId`, `POST /oauth/linkedin-page/select`.
  - UI nova em `apps/web/src/app/dashboard/accounts/page.tsx`: botão "Conectar Página do
    LinkedIn" (disponível mesmo quando já há conexão pessoal — a Página substitui o perfil
    pessoal para fins de publicação desta marca, não coexistem); etapa de seleção quando há
    mais de uma Página administrada; indicador "— Página" / "— Perfil pessoal" no card de
    status da conexão.
- **Decisão de modelo de dados**: a conexão de Página reutiliza o mesmo `pairwiseId`
  (`derivePairwiseId(userId, Platform.LINKEDIN)`) e portanto o mesmo documento Firestore e a
  mesma `tokenRef` da conexão pessoal — escolher conectar a Página **substitui** a conexão
  pessoal para aquela marca, não cria uma segunda conexão em paralelo. Isso é consistente com
  o modelo existente de uma conexão por `(brandId, platform)` (`_local-adr-policy-017`) e com a
  realidade de publicação: uma marca publica no LinkedIn como o perfil pessoal OU como a
  Página, nunca como os dois simultaneamente a partir da mesma marca.
- `LinkedInPublisher.publish` não foi alterado — já usava `connection.organizationUrn ??
  urn:li:person:...` desde a decisão original; o novo fluxo apenas passa a ser capaz de
  popular `organizationUrn` de fato.

## Consequences

- A listagem de páginas administradas (`listAdministeredOrganizations`) e os escopos
  `r_organization_admin`/`w_organization_social` foram revertidos em 2026-06-26 por
  bloqueio estrutural do LinkedIn (ver seção de reversão acima) — `HandleLinkedInCallbackUseCase`
  hoje sempre persiste `organizationUrn: null`, e toda publicação no LinkedIn vai para o
  perfil pessoal do usuário conectado, independentemente de quantas páginas ele administre.
- Publicação em página de empresa do LinkedIn requer decisão sobre criar e manter um
  segundo app dedicado no LinkedIn Developer Portal — sem isso, esta parte da decisão
  permanece sem implementação possível no app atual.
- Mensagem de aviso específica no fluxo do X e a implementação para Meta permanecem como
  trabalho futuro.
- Nenhum impacto em marcas que usam apenas o perfil pessoal — comportamento de publicação
  no LinkedIn é o mesmo de antes desta rodada de decisões.

## References

- [_local-bdr-policy-009-contas-pessoal-profissional-cobranca](../../bdrs/product/009-contas-pessoal-profissional-cobranca.md) - Cenário de agência/múltiplas marcas que origina esta necessidade
- [_local-adr-policy-009-oauth-exclusivo-redes-sociais](009-oauth-social-networks.md) - Modelo geral de integração OAuth por marca
- [_local-adr-policy-017-separacao-pairwiseid-tokenref-oauth](../data/017-separacao-pairwiseid-tokenref-oauth.md) - Isolamento de credenciais por marca
