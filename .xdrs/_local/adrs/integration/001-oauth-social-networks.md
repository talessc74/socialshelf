---
name: _local-adr-policy-001-oauth-social-networks
description: Define o modelo de integração OAuth com redes sociais no SocialShelf. Use ao implementar ou modificar fluxos de autenticação com Instagram, Facebook, LinkedIn ou X/Twitter.
apply-to: Todos os fluxos OAuth com redes sociais externas
valid-from: 2026-06-06
---

# _local-adr-policy-001: OAuth Exclusivo — Integração com Redes Sociais

## Context and Problem Statement

A integração com redes sociais exige acesso a contas do usuário. Armazenar credenciais (login e senha) criaria superfície de ataque crítica e violaria os termos de uso das plataformas.

Como integrar com redes sociais sem armazenar credenciais e com o menor escopo de acesso possível?

## Decision Outcome

**OAuth delegado exclusivo — jamais credenciais, sempre escopo mínimo, tokens por marca**

O fluxo de autorização ocorre inteiramente via redirect OAuth da plataforma de destino. O SocialShelf nunca vê ou armazena login e senha de nenhuma rede social.

### Details

**Regras absolutas**

- Credenciais de redes sociais (login, senha) jamais transitam ou são armazenadas pelo SocialShelf em nenhuma camada (frontend, backend, banco de dados, logs).
- Qualquer proposta de armazenamento de credencial de rede social é rejeitada sem deliberação.
- O fluxo OAuth é iniciado pelo `api-service` e o callback é processado exclusivamente no servidor — nunca no cliente web.

**Fluxo por plataforma**

| Plataforma | Use-case de URL | Use-case de callback | Escopos mínimos |
|---|---|---|---|
| LinkedIn | `GenerateLinkedInAuthUrlUseCase` | `HandleLinkedInCallbackUseCase` | `profile`, `w_member_social` |
| X (Twitter) | `GenerateXAuthUrlUseCase` | `HandleXCallbackUseCase` | Mínimos para posting |
| Meta (Instagram + Facebook) | `GenerateMetaAuthUrlUseCase` | `HandleMetaCallbackUseCase` | Mínimos para publicação |

**Tokens**

- Tokens OAuth são armazenados exclusivamente no Google Secret Manager via `SecretManagerTokenVault`.
- O Firestore armazena apenas `tokenRef` (referência ao secret) — nunca o token.
- Cada marca gerenciada usa credenciais isoladas (`brandId` como parte do namespace do secret).

**Revogação**

- O usuário pode revogar o acesso de qualquer plataforma a qualquer momento na interface.
- Revogação remove o token do Secret Manager e deleta a `OAuthConnection` do Firestore com efeito imediato.
- O sistema não mantém cache de tokens revogados.

**Auditoria**

- Toda publicação é registrada com timestamp, `userId`, `brandId`, plataforma de destino e `postId`.
- Erro de publicação gera notificação imediata ao usuário — o sistema nunca silencia falhas de publicação.

## References

- [_local-adr-policy-003-pairwise-identity-consent](../controls/003-pairwise-identity-consent.md) - Identidade pairwise por plataforma
- [_local-adr-policy-001-zero-trust-baseline](../controls/001-zero-trust-baseline.md) - Acesso restrito ao backend
- [_local-bdr-policy-002-redes-sociais-suportadas](../../bdrs/product/002-redes-sociais-suportadas.md) - Plataformas suportadas
