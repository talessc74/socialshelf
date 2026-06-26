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

## Consequences

- Use-cases de callback de LinkedIn ganham uma etapa intermediária (listar páginas) que
  hoje não existe; quando há exatamente 0 ou 1 página, o fluxo permanece "autoriza e
  conecta" direto, sem fricção adicional.
- Quando há mais de uma página administrada pelo login do LinkedIn, a conexão falha hoje
  com `linkedin_multiple_organizations` — a tela de conexão em `apps/web` ainda precisa
  do estado de UI para seleção explícita (não implementado nesta rodada).
- Mensagem de aviso específica no fluxo do X e a implementação para Meta permanecem como
  trabalho futuro.
- Nenhum impacto em marcas que já têm exatamente uma página/conta disponível —
  comportamento é corrigido para publicar nessa página em vez do perfil pessoal.

## References

- [_local-bdr-policy-009-contas-pessoal-profissional-cobranca](../../bdrs/product/009-contas-pessoal-profissional-cobranca.md) - Cenário de agência/múltiplas marcas que origina esta necessidade
- [_local-adr-policy-009-oauth-exclusivo-redes-sociais](009-oauth-social-networks.md) - Modelo geral de integração OAuth por marca
- [_local-adr-policy-017-separacao-pairwiseid-tokenref-oauth](../data/017-separacao-pairwiseid-tokenref-oauth.md) - Isolamento de credenciais por marca
