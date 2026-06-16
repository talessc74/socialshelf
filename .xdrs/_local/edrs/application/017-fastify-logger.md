---
name: _local-edr-policy-017-fastify-logger-com-log-level
description: Define o padrão de logging nos serviços Fastify. Use ao adicionar logs em novo serviço ou ao configurar nível de log por ambiente.
apply-to: Todos os apps Fastify — app.ts
valid-from: 2026-06-16
---

# _local-edr-policy-017: Fastify Logger com LOG_LEVEL

## Context and Problem Statement

Logging manual com `console.log` não tem nível de severidade, não é configurável por ambiente e produz output não estruturado — difícil de filtrar no Cloud Logging do GCP.

Como padronizar logging nos serviços Fastify para que seja estruturado, configurável por ambiente e integrado à infraestrutura de observabilidade do GCP?

## Decision Outcome

**Logger nativo do Fastify habilitado com nível configurável via `LOG_LEVEL`**

### Details

**Configuração em `buildApp()`**

```typescript
const app = fastify({
  logger: {
    level: process.env['LOG_LEVEL'] ?? 'info',
  },
})
```

**Variável `LOG_LEVEL`**

| Ambiente | Valor recomendado |
|---|---|
| Produção | `info` (padrão se ausente) |
| Desenvolvimento local | `debug` |
| CI / testes | `warn` ou `silent` |

**Logger nativo do Fastify**

O Fastify usa `pino` internamente. Cada requisição gera automaticamente logs de entrada e saída com `method`, `url`, `statusCode` e `responseTime`. Nenhuma instrumentação adicional é necessária para observabilidade básica.

**Uso em código**

```typescript
app.log.info({ userId }, 'Processing OAuth callback')
app.log.error({ error, tokenRef }, 'Failed to retrieve token')
```

Logs estruturados como objetos — não concatenação de strings. O Cloud Logging do GCP parseia automaticamente JSON estruturado como campos pesquisáveis.

**O que não fazer**

- `console.log` em código de produção — não tem nível, não é estruturado
- Logar tokens, senhas ou dados pessoais — proibido por ADR-006 e ADR-008
- Usar `logger: false` em produção — elimina toda observabilidade

## References

- [_local-adr-policy-006-dados-como-passivo-minimizacao](../../adrs/controls/006-data-minimization.md) - Dados pessoais não devem aparecer em logs
- [_local-adr-policy-010-gcp-infrastructure-baseline](../../adrs/platform/010-gcp-infrastructure.md) - Cloud Logging como destino dos logs de produção
