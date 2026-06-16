---
name: _local-adr-policy-015-firestore-security-rules-implicit-deny
description: Define o modelo de regras de segurança do Firestore — implicit deny com acesso baseado em propriedade. Use ao alterar firestore.rules ou adicionar novas coleções.
apply-to: firestore.rules
valid-from: 2026-06-16
---

# _local-adr-policy-015: Firestore Security Rules — Implicit Deny

## Context and Problem Statement

Firestore permite acesso por padrão se nenhuma regra corresponder. Em um sistema multi-tenant com dados de OAuth e conteúdo por marca, qualquer regra ausente ou mal-escrita pode expor dados de outros usuários.

Como estruturar as rules do Firestore para garantir que nenhum acesso não autorizado seja possível, mesmo em caso de regra ausente?

## Decision Outcome

**Implicit deny como regra final + acesso baseado em propriedade (`isOwner`) para leitura cliente**

Toda escrita de dados sensíveis é reservada ao backend. O cliente (Firebase SDK) só pode ler os dados da própria conta.

### Details

**Regra catch-all obrigatória**

A última regra de qualquer configuração Firestore do SocialShelf deve ser:

```javascript
match /{document=**} {
  allow read, write: if false;
}
```

Isso garante que qualquer coleção nova, criada sem regras correspondentes, seja inacessível até que uma regra explícita seja adicionada.

**Funções auxiliares**

```javascript
function isAuthenticated() {
  return request.auth != null;
}
function isOwner(userId) {
  return request.auth.uid == userId;
}
```

**Modelo de acesso por coleção**

| Coleção | Leitura cliente | Escrita cliente |
|---|---|---|
| `users/{userId}` | `isOwner(userId)` | `isOwner(userId)` |
| `users/{userId}/ai_consent` | `isOwner(userId)` | `isOwner(userId)` |
| `users/{userId}/daily_quota` | `isOwner(userId)` | `false` — apenas backend |
| `users/{userId}/brands` | `isOwner(userId)` | `isOwner(userId)` |
| `brands/{id}/oauth_connections` | `isOwner(userId)` | `false` — apenas backend |
| `brands/{id}/posts` | `isOwner(userId)` | `isOwner(userId)` |
| `brands/{id}/generation_requests` | `isOwner(userId)` | `false` — apenas backend |
| `token_vault` | `false` | `false` — apenas backend via Admin SDK |

**Regra de adição de coleção**

Toda nova coleção deve ter regra explícita antes de entrar em produção. Coleção sem regra = inacessível (via catch-all). Não existe "provisório" — a regra vai junto com o schema.

## References

- [_local-adr-policy-005-zero-trust-baseline](005-zero-trust-baseline.md) - Implicit deny como princípio base de segurança
- [_local-adr-policy-020-firestore-hierarquia-de-sub-documentos](../platform/020-firestore-schema.md) - Hierarquia de coleções documentada
- [_local-adr-policy-012-token-vault-criptografia-aes-256-gcm](012-token-vault-encryption.md) - token_vault protegido adicionalmente por criptografia
