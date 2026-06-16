---
name: _local-adr-policy-013-pkce-por-plataforma-oauth-seletivo
description: Define o uso de PKCE (RFC 7636) por plataforma no fluxo OAuth. Use ao implementar ou revisar o fluxo de autorização OAuth de qualquer rede social suportada.
apply-to: apps/api — use-cases de OAuth e lib/x-client.ts
valid-from: 2026-06-16
---

# _local-adr-policy-013: PKCE por Plataforma — OAuth Seletivo

## Context and Problem Statement

PKCE (Proof Key for Code Exchange, RFC 7636) protege o fluxo OAuth contra interceptação do authorization code. Nem todas as plataformas suportam ou exigem PKCE — a decisão de usar ou não deve ser explícita e documentada por plataforma.

Como aplicar PKCE no fluxo OAuth do SocialShelf considerando as diferenças de suporte entre plataformas?

## Decision Outcome

**PKCE obrigatório para X (Twitter); não aplicável para LinkedIn e Meta**

Cada plataforma tem uma decisão explícita. Ausência de PKCE em LinkedIn e Meta não é omissão — é conformidade com as especificações de OAuth dessas plataformas.

### Details

**X (Twitter) — PKCE S256 obrigatório**

- `codeVerifier`: 32 bytes aleatórios em base64url (gerado por `generatePkce()` em `lib/x-client.ts`)
- `codeChallenge`: SHA-256(`codeVerifier`) em base64url (método S256)
- O `codeVerifier` é embutido dentro do state JWT (não em cookie) — ver ADR-014
- Parâmetros enviados na URL de autorização: `code_challenge`, `code_challenge_method=S256`
- No callback: `codeVerifier` extraído do state validado e enviado para troca de token

**LinkedIn — PKCE não aplicável**

LinkedIn OAuth 2.0 não exige PKCE para aplicações server-side (confidential clients). A segurança é garantida pelo `client_secret` e pelo state parameter (ADR-014).

**Meta (Instagram/Facebook) — PKCE não aplicável**

Meta Graph API OAuth usa fluxo server-side com `client_secret`. PKCE não é suportado nem exigido para o fluxo de autorização usado.

**Princípio geral**

Não implementar PKCE onde a plataforma não suporta ou não exige — PKCE nessas plataformas pode causar erros de validação no callback. A decisão por plataforma é a única abordagem válida.

## References

- [_local-adr-policy-009-oauth-exclusivo-redes-sociais](009-oauth-social-networks.md) - OAuth como único modelo de integração
- [_local-adr-policy-014-state-oauth-hmac-sha256-com-expiracao](../controls/014-state-oauth-hmac-sha256.md) - State parameter com HMAC-SHA256 e embedding de codeVerifier
