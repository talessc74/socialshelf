---
name: _local-adr-policy-034-tiktok-oauth-e-identificadores-pairwise
description: Define o modelo OAuth do TikTok e a escolha de identificador pairwise entre open_id e union_id. Use ao implementar GenerateTikTokAuthUrlUseCase, HandleTikTokCallbackUseCase ou qualquer lógica que leia a resposta do token endpoint do TikTok.
apply-to: apps/api — use-cases de OAuth do TikTok; packages/domain — OAuthConnection
valid-from: 2026-07-06
---

# _local-adr-policy-034: TikTok — OAuth e Identificadores Pairwise

## Context and Problem Statement

[_local-adr-policy-009-oauth-exclusivo-redes-sociais](009-oauth-social-networks.md) estabelece OAuth delegado exclusivo como único modelo de integração com redes sociais. O TikTok se junta a LinkedIn, X e Meta como quinta plataforma, mas tem duas particularidades que as demais não têm: retorna **dois identificadores de usuário** (`open_id` e `union_id`) na resposta do token, e o `access_token` expira em 24 horas — bem mais curto que os 60 dias de LinkedIn/Meta.

Qual identificador usar como `pairwiseId`, e como o ciclo de vida curto do token se encaixa na estratégia de refresh já estabelecida?

## Decision Outcome

**`pairwiseId` segue o mesmo padrão determinístico já implementado para as demais plataformas (ADR-017: `SHA256(userId:platform)`, nunca o identificador retornado pela rede); `open_id` do TikTok é guardado apenas dentro do blob criptografado do token vault, para uso futuro em chamadas à API. `union_id` é descartado no momento do callback, antes de qualquer persistência ou log. Refresh automático, seguindo a mesma categoria de X.**

### Details

**Atualização 2026-07-08 — alinhamento com ADR-017**

A redação original desta seção ("`pairwiseId` = `open_id` exclusivamente") contradizia [_local-adr-policy-017-separacao-pairwiseid-e-tokenref-oauth](../data/017-separacao-pairwiseid-tokenref-oauth.md), que já define `pairwiseId` como um hash determinístico derivado de `userId + platform` — nunca o identificador literal devolvido pela rede social. Essa contradição só ficou visível na implementação de `HandleTikTokCallbackUseCase`. `pairwiseId` do TikTok segue exatamente o mesmo `derivePairwiseId(userId, Platform.TIKTOK)` usado por LinkedIn/X/Meta. `open_id` é armazenado apenas dentro do JSON criptografado do token vault (ao lado de `access_token`/`refresh_token`), nunca como `pairwiseId` nem em campo indexado do Firestore.

**Por que `open_id` e não `union_id`**

`union_id` correlaciona o mesmo usuário **entre múltiplos apps do mesmo desenvolvedor TikTok** — é, por definição, um identificador de rastreamento cruzado. Isso viola diretamente [_local-adr-policy-007-identidade-pairwise-e-consentimento](../controls/007-pairwise-identity-consent.md), que já rege as outras quatro plataformas. `open_id` é escopado ao app do SocialShelf — por isso é aceitável guardá-lo no vault (nunca como `pairwiseId`), enquanto `union_id` não é aceitável em lugar nenhum.

`union_id`, quando presente na resposta do TikTok, é descartado em `HandleTikTokCallbackUseCase` antes de qualquer persistência — não é armazenado, não é logado, não transita para o Firestore em nenhum campo.

**Escopos mínimos — confirmado na implementação (2026-07-08)**

`user.info.basic` (Login Kit) e `video.publish` (Content Posting API, publicação direta) — confirmados diretamente na tela de Scopes do TikTok for Developers ao adicionar os dois produtos ao app. `video.upload` (fluxo de rascunho, para o usuário editar dentro do app do TikTok) existe como escopo alternativo mas não é solicitado — ADR-035 decide por Direct Post, não pelo fluxo de rascunho. Escopos são enviados **separados por vírgula** na URL de autorização do TikTok — diferente de X/LinkedIn/Meta, que usam espaço.

**PKCE — confirmado na implementação (2026-07-08)**

TikTok exige PKCE (`code_challenge`, `code_challenge_method=S256`, `code_verifier`) mesmo para cliente confidencial server-side — diferente de LinkedIn e Meta (ADR-013), mas igual a X. `GenerateTikTokAuthUrlUseCase` e `HandleTikTokCallbackUseCase` seguem exatamente o mesmo padrão já usado para X (`generatePkce()`, `codeVerifier` embutido no state HMAC, nunca em cookie).

**Ciclo de vida do token**

| Campo | Valor |
|---|---|
| `access_token` | Expira em 24 horas |
| `refresh_token` | Expira em ~1 ano (31536000s) |
| Refresh | Sem necessidade de novo consentimento do usuário |

TikTok se junta a X na categoria de "refresh automático" de [_local-adr-policy-016-refresh-de-token-oauth-por-plataforma](016-refresh-token-oauth.md): no 401, `TikTokPublisher` tenta refresh via o token endpoint (`https://open.tiktokapis.com/v2/oauth/token/`, `grant_type=refresh_token`) antes de propagar erro ao usuário. `refresh_token` armazenado no Secret Manager seguindo [_local-adr-policy-012-token-vault-criptografia-aes-256-gcm](../controls/012-token-vault-encryption.md), mesmo padrão das demais plataformas.

**Revogação**

TikTok expõe endpoint de revogação (`https://open.tiktokapis.com/v2/oauth/revoke/`). Revogação de conexão TikTok chama esse endpoint antes de deletar o token do Secret Manager e a `OAuthConnection` do Firestore — mesmo comportamento de efeito imediato já exigido por ADR-009.

## References

- [_local-adr-policy-009-oauth-exclusivo-redes-sociais](009-oauth-social-networks.md) - OAuth como único modelo de integração
- [_local-adr-policy-007-identidade-pairwise-e-consentimento](../controls/007-pairwise-identity-consent.md) - Identidade pairwise por plataforma
- [_local-adr-policy-013-pkce-por-plataforma-oauth-seletivo](013-pkce-por-plataforma.md) - Precedente de decisão explícita de PKCE por plataforma
- [_local-adr-policy-016-refresh-de-token-oauth-por-plataforma](016-refresh-token-oauth.md) - Categoria de refresh automático (X) que TikTok segue
- [_local-bdr-policy-003-redes-sociais-suportadas](../../bdrs/product/003-redes-sociais-suportadas.md) - TikTok como quinta plataforma suportada
