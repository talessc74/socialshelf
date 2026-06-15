---
name: _local-edr-policy-003-fastify-plugins-padrao
description: Define Fastify como framework HTTP e os plugins obrigatórios nos serviços backend do SocialShelf. Use ao criar novos endpoints, configurar middleware ou adicionar serviços backend.
apply-to: apps/api, apps/publisher, apps/generator
valid-from: 2026-06-06
---

# _local-edr-policy-003: Fastify + Plugins Padrão

## Context and Problem Statement

Os três serviços backend precisam de um framework HTTP com suporte a plugins, boa performance e integração simples com Vitest. A configuração de segurança HTTP (CORS, headers, rate limiting) deve ser consistente entre serviços.

Qual framework e quais plugins são padrão para os serviços backend?

## Decision Outcome

**Fastify com plugins `@fastify/cors`, `@fastify/helmet`, `@fastify/rate-limit` e `@fastify/cookie` registrados em todos os serviços**

Plugins de segurança são registrados na inicialização do app — não são opcionais por serviço.

### Details

**Plugins obrigatórios em todo serviço backend**

| Plugin | Propósito |
|---|---|
| `@fastify/cors` | Controle de Cross-Origin Resource Sharing |
| `@fastify/helmet` | Headers de segurança HTTP (CSP, HSTS, X-Frame-Options, etc.) |
| `@fastify/rate-limit` | Proteção contra abuso por limitação de taxa de requisições |
| `@fastify/cookie` | Parsing e serialização de cookies (necessário para sessão OAuth) |

**Estrutura de app**

```typescript
// apps/[service]/src/app.ts
const app = fastify({ logger: true })
await app.register(cors, { ... })
await app.register(helmet)
await app.register(rateLimit, { ... })
await app.register(cookie, { secret: process.env.CSRF_SECRET })
```

**Rotas**

- Rotas são organizadas por domínio em `routes/[dominio].routes.ts`.
- Cada arquivo de rotas é um plugin Fastify registrado via `app.register()`.
- Handlers de rota delegam para use-cases — nenhuma lógica de negócio nos handlers.

**Testes**

- Use `app.inject()` do Fastify para testes de integração de rotas sem subir servidor real.
- Dependências (repositórios, portas) são injetadas no construtor do use-case — substituíveis por mocks nos testes.

**O que não é permitido**

- Lógica de negócio diretamente em handlers de rota.
- Acesso direto a SDKs de infraestrutura (Firebase Admin, `@google-cloud/*`) em handlers.
- Desabilitar `@fastify/helmet` ou `@fastify/rate-limit` em produção.

## References

- [_local-adr-policy-001-hexagonal-architecture](../../adrs/application/002-hexagonal-architecture.md) - Handlers delegam para use-cases
- [_local-adr-policy-001-zero-trust-baseline](../../adrs/controls/005-zero-trust-baseline.md) - Plugins de segurança como baseline
