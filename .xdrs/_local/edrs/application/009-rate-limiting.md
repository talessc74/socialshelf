---
name: _local-edr-policy-009-rate-limiting-global-api
description: Define o rate limiting global dos serviços Fastify. Use ao ajustar limites de requisição ou ao adicionar limites específicos por rota.
apply-to: apps/api e apps/publisher — app.ts
valid-from: 2026-06-16
---

# _local-edr-policy-009: Rate Limiting Global API

## Context and Problem Statement

Sem limite de requisições, um cliente mal-intencionado ou defeituoso pode saturar o serviço com chamadas em alta frequência — afetando outros usuários e gerando custos de infraestrutura desnecessários.

Como proteger os serviços Fastify contra abuso de taxa de requisição?

## Decision Outcome

**100 requisições por minuto por IP via `@fastify/rate-limit` registrado globalmente**

### Details

**Configuração**

```typescript
await app.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
})
```

Registrado no `buildApp()` de cada serviço — aplica-se a todas as rotas automaticamente.

**Resposta em excesso de limite**

`@fastify/rate-limit` retorna HTTP 429 com headers padrão:
- `X-RateLimit-Limit`: limite configurado
- `X-RateLimit-Remaining`: requisições restantes na janela
- `Retry-After`: segundos até renovação da janela

**Limites específicos por rota**

Rotas com custo computacional alto (ex: geração de conteúdo) podem ter limite próprio menor via opção `config.rateLimit` na rota. O limite global de 100/min é o teto máximo — limites por rota só podem ser menores.

**Limites não cobertos**

Este controle protege contra volume de requisições, não contra complexidade de payload ou custo de operação individual. Operações de geração de IA têm controle adicional via `daily_quota` no Firestore.

## References

- [_local-adr-policy-005-zero-trust-baseline](../../adrs/controls/005-zero-trust-baseline.md) - Proteção em todas as camadas como princípio base
- [_local-edr-policy-003-fastify-plugins-padrao](003-fastify-plugins.md) - rate-limit como plugin obrigatório do Fastify
