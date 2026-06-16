---
name: _local-adr-policy-014-state-oauth-hmac-sha256-com-expiracao
description: Define o esquema do state parameter OAuth — HMAC-SHA256 com nonce, timestamp e expiração. Use ao implementar ou revisar qualquer fluxo OAuth do sistema.
apply-to: apps/api — lib/csrf.ts e todos os use-cases de OAuth
valid-from: 2026-06-16
---

# _local-adr-policy-014: State OAuth — HMAC-SHA256 com Expiração

## Context and Problem Statement

O parâmetro `state` do OAuth previne ataques CSRF no fluxo de autorização. Uma implementação ingênua (valor estático ou previsível) não oferece proteção real. Sem expiração, um state capturado pode ser reutilizado indefinidamente.

Como implementar o state parameter para garantir proteção CSRF, unicidade por requisição, e carregamento seguro de dados auxiliares (como o `codeVerifier` do PKCE)?

## Decision Outcome

**State = Base64URL(payload JSON) + '.' + Base64URL(HMAC-SHA256(payload))**

Cada state é único por requisição, assinado, com expiração de 10 minutos e comparação timing-safe na validação.

### Details

**Estrutura do payload**

```typescript
interface StatePayload {
  userId: string
  nonce: string      // randomBytes(16) em hex — unicidade por requisição
  iat: number        // timestamp Unix — base para expiração
  codeVerifier?: string  // presente apenas para X (Twitter)
}
```

**Serialização**

```
state = base64url(JSON(payload)) + '.' + base64url(HMAC-SHA256(CSRF_SECRET, JSON(payload)))
```

**Validação no callback**

1. Split no `.` — extrai payload e assinatura
2. Recalcula HMAC da parte payload
3. Compara com `timingSafeEqual` — previne timing attacks na comparação de strings
4. Verifica `iat + 10min > now` — rejeita states expirados
5. Verifica `userId` do state contra usuário autenticado da sessão

**Expiração**

10 minutos (`TEN_MINUTES = 10 * 60 * 1000`). Janela suficiente para o usuário completar a autorização na plataforma, sem permitir reutilização em caso de captura.

**Por que HMAC no state e não cookie?**

Cookie exigiria infraestrutura de sessão stateful ou cookie seguro por request. HMAC no state é stateless — o state carrega sua própria prova de integridade, verificável por qualquer instância do serviço sem compartilhamento de estado.

## References

- [_local-adr-policy-013-pkce-por-plataforma-oauth-seletivo](../integration/013-pkce-por-plataforma.md) - codeVerifier embarcado no state para X
- [_local-adr-policy-005-zero-trust-baseline](005-zero-trust-baseline.md) - Verificação explícita em cada requisição
