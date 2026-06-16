---
name: _local-edr-policy-020-helmet-security-headers
description: Define o uso de Helmet para headers de segurança HTTP nos serviços Fastify. Use ao revisar postura de segurança HTTP ou ao configurar novo serviço Fastify.
apply-to: apps/api e apps/publisher — app.ts
valid-from: 2026-06-16
---

# _local-edr-policy-020: Helmet Security Headers

## Context and Problem Statement

Respostas HTTP sem headers de segurança expõem o cliente a ataques de XSS, clickjacking, MIME sniffing e outros vetores de browser. Configurar cada header manualmente é propenso a omissões.

Como garantir que todos os serviços Fastify retornem os headers de segurança HTTP recomendados sem configuração manual por rota?

## Decision Outcome

**`@fastify/helmet` registrado globalmente em todos os serviços Fastify**

```typescript
await app.register(helmet)
```

### Details

**Headers aplicados por padrão**

`@fastify/helmet` aplica os headers recomendados pelo projeto Helmet:

| Header | Proteção |
|---|---|
| `Content-Security-Policy` | XSS e injeção de conteúdo |
| `X-Content-Type-Options: nosniff` | MIME type sniffing |
| `X-Frame-Options: SAMEORIGIN` | Clickjacking |
| `Strict-Transport-Security` | Força HTTPS |
| `X-DNS-Prefetch-Control` | Vazamento de informação via DNS prefetch |
| `Referrer-Policy` | Controle de Referer header |

**Configuração padrão suficiente**

Para os serviços do SocialShelf (APIs REST sem renderização HTML), a configuração padrão do Helmet é adequada. Customização do CSP não é necessária — as APIs não servem HTML com scripts inline.

**Registrar antes das rotas**

Helmet deve ser registrado antes dos plugins de rota no `buildApp()` para garantir que os headers sejam aplicados a todas as respostas, incluindo respostas de erro do Fastify.

**Exceção para rotas de health check**

Rotas de health check (`GET /health`) retornam JSON simples. Helmet aplica os headers normalmente — sem necessidade de exceção.

## References

- [_local-adr-policy-005-zero-trust-baseline](../../adrs/controls/005-zero-trust-baseline.md) - Defesa em profundidade como princípio base
- [_local-edr-policy-003-fastify-plugins-padrao](003-fastify-plugins.md) - Helmet como plugin obrigatório do Fastify
