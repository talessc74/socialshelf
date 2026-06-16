---
name: _local-edr-policy-021-health-check-padrao
description: Define o endpoint de health check obrigatório em todos os serviços. Use ao configurar health checks no Cloud Run ou ao adicionar novo serviço.
apply-to: Todos os apps Fastify — health.routes.ts
valid-from: 2026-06-16
---

# _local-edr-policy-021: Health Check Padrão

## Context and Problem Statement

O Cloud Run usa health checks para determinar se uma instância está pronta para receber tráfego. Sem endpoint de health check, o Cloud Run usa TCP por padrão — que não verifica se a aplicação Node.js inicializou corretamente.

Como expor observabilidade de liveness de cada serviço de forma padronizada?

## Decision Outcome

**`GET /health` em todos os serviços retornando `{ status, service, timestamp }`**

### Details

**Formato de resposta**

```typescript
// HTTP 200
{
  status: 'ok',
  service: 'api-service',       // nome do serviço
  timestamp: '2026-06-16T00:00:00.000Z'  // ISO 8601
}
```

**Implementação**

```typescript
app.get('/health', async (_request, reply) => {
  return reply.send({
    status: 'ok',
    service: process.env['SERVICE_NAME'] ?? 'unknown',
    timestamp: new Date().toISOString(),
  })
})
```

**`timestamp` como indicador de liveness**

O `timestamp` é gerado no momento da requisição — não em tempo de build. Uma instância que responde com timestamp atual está viva e processando requisições. Timestamp estático indicaria cache indevido.

**Sem verificação de dependências**

O health check responde `ok` se o processo Node.js está rodando e aceitando conexões. Não verifica conectividade com Firestore, GCP ou serviços externos — falhas de dependência são tratadas nas rotas de negócio, não no health check.

**Rota sem autenticação**

`GET /health` não requer Firebase Auth — é acessível sem token. O Cloud Run precisa verificar health sem contexto de usuário.

## References

- [_local-adr-policy-022-cloud-run-configuracao-por-servico](../../adrs/platform/022-cloud-run-config.md) - Cloud Run usa este endpoint para verificar liveness
