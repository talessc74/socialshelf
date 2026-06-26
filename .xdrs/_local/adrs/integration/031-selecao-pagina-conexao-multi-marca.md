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

**Sem mudança de modelo de dados**

- `OAuthConnection` permanece isolada por `(brandId, platform)` (`_local-adr-policy-009`, `_local-adr-policy-017`). Esta decisão afeta apenas o fluxo de seleção antes da persistência, não o schema.

## Consequences

- Use-cases de callback de LinkedIn e Meta ganham uma etapa intermediária (listar e aguardar seleção) que hoje não existe — fluxo deixa de ser "autoriza e conecta" direto quando há múltiplas páginas.
- A tela de conexão em `apps/web` precisa de um novo estado de UI para a etapa de seleção de página, e de uma mensagem de aviso específica no fluxo do X.
- Nenhum impacto em marcas que já têm exatamente uma página/conta disponível — comportamento atual é preservado.

## References

- [_local-bdr-policy-009-contas-pessoal-profissional-cobranca](../../bdrs/product/009-contas-pessoal-profissional-cobranca.md) - Cenário de agência/múltiplas marcas que origina esta necessidade
- [_local-adr-policy-009-oauth-exclusivo-redes-sociais](009-oauth-social-networks.md) - Modelo geral de integração OAuth por marca
- [_local-adr-policy-017-separacao-pairwiseid-tokenref-oauth](../data/017-separacao-pairwiseid-tokenref-oauth.md) - Isolamento de credenciais por marca
