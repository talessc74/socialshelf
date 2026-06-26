---
name: _local-adr-policy-031-selecao-de-pagina-na-conexao-oauth-multi-marca
description: Define como o fluxo de conexão OAuth seleciona qual página/conta de cada plataforma fica vinculada a cada marca, e a limitação conhecida do X para múltiplas contas. Use ao implementar ou revisar o fluxo de conexão de marca.
apply-to: Fluxo de conexão OAuth por marca (apps/api use-cases de oauth, tela de conexão em apps/web)
valid-from: 2026-06-26
---

# _local-adr-policy-031: Seleção de Página na Conexão OAuth Multi-Marca

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
