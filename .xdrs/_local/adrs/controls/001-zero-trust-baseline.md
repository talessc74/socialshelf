---
name: _local-adr-policy-001-zero-trust-baseline
description: Define Zero Trust como modelo de segurança base do SocialShelf. Use ao projetar qualquer fluxo de autenticação, autorização, acesso a dados ou comunicação entre serviços.
apply-to: Todos os serviços, regras de banco de dados e fluxos de autenticação
valid-from: 2026-06-06
---

# _local-adr-policy-001: Zero Trust Baseline

## Context and Problem Statement

Um SaaS multi-tenant com dados de usuário, tokens OAuth de redes sociais e comunicação entre serviços internos não pode depender de perímetro de rede ou "confiança por origem" como modelo de segurança.

Como garantir que nenhum acesso seja concedido sem verificação explícita, independente de onde a requisição se origina?

## Decision Outcome

**Negação implícita em todas as camadas: Firestore, Cloud Run e comunicação entre serviços**

Toda requisição deve provar identidade e autorização antes de receber acesso. Sessões ativas são verificadas continuamente. Violação resulta em encerramento imediato.

### Details

**Firestore (firestore.rules)**

Regra base obrigatória no final de todas as rules:
```
match /{document=**} {
  allow read, write: if false;
}
```

Toda regra de acesso deve verificar:
```javascript
function isAuthenticated() {
  return request.auth != null;
}
function isOwner(userId) {
  return request.auth.uid == userId;
}
```

Escrita de dados sensíveis (oauth_connections, daily_quota) é restrita ao backend: `allow write: if false` no cliente — apenas o `api-service` via Firebase Admin pode escrever.

**Cloud Run**

- `publisher` e `generator` têm `--no-allow-unauthenticated` — inacessíveis publicamente.
- Comunicação interna usa `INTERNAL_SECRET` validado em middleware no serviço receptor.
- Cada serviço tem IAM roles mínimas: `api-service` não pode chamar Vertex AI; `generator` não pode gerenciar secrets OAuth.

**Micro-segmentação por serviço**

Cada serviço no Cloud Run é tratado como zona de confiança distinta. Acesso de um serviço a outro requer autenticação explícita — nunca confiança implícita por estarem na mesma rede GCP.

**Sessões**

Sessões Firebase verificadas a cada requisição via middleware de autenticação do `api`. Token inválido ou expirado resulta em 401 imediato — sem fallback ou cache de autenticação.

## References

- [_local-adr-policy-003-pairwise-identity-consent](003-pairwise-identity-consent.md) - Identidade e consentimento
- [_local-adr-policy-002-data-minimization](002-data-minimization.md) - Minimização de superfície de exposição
- [_local-edr-policy-001-cloud-run](../../edrs/infra/001-cloud-run.md) - Configuração IAM por serviço
