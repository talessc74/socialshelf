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

**`pairwiseId` = `open_id` exclusivamente; `union_id` é descartado no momento do callback, antes de qualquer persistência ou log. Refresh automático, seguindo a mesma categoria de X.**

### Details

**Por que `open_id` e não `union_id`**

`union_id` correlaciona o mesmo usuário **entre múltiplos apps do mesmo desenvolvedor TikTok** — é, por definição, um identificador de rastreamento cruzado. Isso viola diretamente [_local-adr-policy-007-identidade-pairwise-e-consentimento](../controls/007-pairwise-identity-consent.md), que já rege as outras quatro plataformas. `open_id` é escopado ao app do SocialShelf e é o equivalente funcional ao identificador pairwise usado em LinkedIn/X/Meta.

`union_id`, quando presente na resposta do TikTok, é descartado em `HandleTikTokCallbackUseCase` antes de qualquer persistência — não é armazenado, não é logado, não transita para o Firestore em nenhum campo.

**Escopos mínimos**

Escopo mínimo necessário para publicação de vídeo, seguindo o princípio de mínimo privilégio já aplicado às demais plataformas (ADR-009). `user.info.basic` é adicionado por padrão pelo Login Kit do TikTok — o escopo específico de publicação de vídeo deve ser confirmado contra a documentação vigente da TikTok API no momento da implementação (nomenclatura de scopes é mais granular que as demais plataformas e pode variar por tipo de app).

**PKCE**

Seguindo o mesmo raciocínio de [_local-adr-policy-013-pkce-por-plataforma-oauth-seletivo](013-pkce-por-plataforma.md): o SocialShelf usa cliente confidencial (server-side, com `client_secret`), o que historicamente dispensa PKCE nas demais plataformas (LinkedIn, Meta). PKCE para TikTok deve ser confirmado contra a documentação vigente no momento da implementação antes de decidir omiti-lo — ausência de verificação explícita não é decisão válida.

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
