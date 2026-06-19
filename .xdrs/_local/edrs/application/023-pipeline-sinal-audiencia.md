---
name: _local-edr-policy-023-pipeline-sinal-audiencia-sem-retencao
description: Define como métricas brutas por post são lidas, agregadas em memória e descartadas, persistindo apenas o AudienceSignal final. Use ao implementar leitores de analytics, ComputeAudienceSignalUseCase, ou o proxy api → publisher para /audience-signal.
apply-to: apps/publisher — infrastructure/analytics, ComputeAudienceSignalUseCase; apps/api — audience-signal.routes
valid-from: 2026-06-19
---

# _local-edr-policy-023: Pipeline Sinal Audiência sem Retenção

## Context and Problem Statement

[_local-adr-policy-026-sinal-de-audiencia-minimizacao-e-leitura](../../adrs/controls/026-sinal-audiencia-minimizacao.md) decide que apenas o `AudienceSignal` agregado é persistido — nunca métricas brutas por post, nunca dado identificável de seguidores. Falta definir, no nível de implementação, como o pipeline garante isso na prática (e não apenas na intenção), e como os adapters de leitura por plataforma se encaixam no padrão hexagonal já estabelecido para `publishers/`.

## Decision Outcome

**`ComputeAudienceSignalUseCase` busca métricas por post via `AnalyticsReaderPort`, acumula em variáveis locais, e só constrói o objeto `AudienceSignal` ao final — nenhum repositório é chamado entre a leitura e a agregação final.**

```typescript
let totalImpressions = 0
let totalEngagements = 0
let postsAnalyzed = 0

for (const post of postsWithExternalId) {
  const metrics = await reader.fetchPostMetrics(post.externalIds[platform], connection)
  totalImpressions += metrics.impressions
  totalEngagements += metrics.likes + metrics.comments + metrics.shares
  postsAnalyzed += 1
}

const signal: AudienceSignal = {
  id: randomUUID(),
  brandId,
  platform,
  postsAnalyzed,
  totalImpressions,
  totalEngagements,
  avgEngagementRate: totalImpressions > 0 ? totalEngagements / totalImpressions : 0,
  computedAt: new Date(),
}
await this.audienceSignalRepo.save(signal)
return signal
```

### Details

**Adapters de leitura seguem o mesmo padrão que `publishers/`**

Cada plataforma tem um `infrastructure/analytics/{Platform}AnalyticsReader.ts` que implementa `AnalyticsReaderPort.fetchPostMetrics(externalId, connection): Promise<PostMetrics>`, recebendo o token via `TokenVaultPort` já injetado no `publisher` — espelhando exatamente como `LinkedInPublisher`/`MetaPublisher`/`XPublisher` já leem o token para publicar. `MetaAnalyticsReader` é reutilizado tanto para `FACEBOOK` quanto para `INSTAGRAM` (mesma reutilização já existente em `MetaPublisher`), com branch interno por `connection.platform`.

**O teste de minimização é código, não apenas documentação**

`ComputeAudienceSignalUseCase.test.ts` inclui um teste que insp​eciona o objeto passado para `audienceSignalRepo.save()` e falha se ele tiver uma propriedade `posts` ou `rawMetrics` — qualquer regressão futura que comece a vazar dado por post para o repositório quebra esse teste, não apenas uma revisão manual de ADR.

**Versionamento por criação, nunca por atualização**

Assim como `BrandProfile` ([_local-edr-policy-022](022-snapshot-imutavel-brand-profile-post.md) trata o caso análogo para posts), cada chamada a `execute()` cria um novo documento `AudienceSignal` com `id` e `computedAt` novos — não há `update()` no repositório. `findLatestByBrandAndPlatform` ordena por `computedAt` desc e retorna o primeiro.

**Proxy `api → publisher` reutiliza o padrão de `/publish`**

`apps/api/src/routes/audience-signal.routes.ts` expõe `GET /audience-signal?platform=X` autenticado por Firebase (`app.authenticate`), e internamente faz `POST {PUBLISHER_URL}/audience-signal` com o header `X-Internal-Secret`, usando `request.userId` como `brandId` — o mesmo padrão de proxy já usado por `posts.routes.ts` para `/posts/:id/publish`. `api` nunca lê o token OAuth nem chama a plataforma diretamente.

**O que isso não resolve**

Cache de sinal de audiência (evitar recomputar a cada chamada) é decisão de fase futura, fora do escopo da Fase 1. Hoje cada `GET /audience-signal` no `api` dispara uma computação completa no `publisher`.

## References

- [_local-adr-policy-026-sinal-de-audiencia-minimizacao-e-leitura](../../adrs/controls/026-sinal-audiencia-minimizacao.md) - Decisão estrutural de minimização que este EDR implementa
- [_local-edr-policy-022-snapshot-imutavel-de-brandprofile-por-post](022-snapshot-imutavel-brand-profile-post.md) - Padrão análogo de criar-nunca-atualizar
- [_local-bdr-plan-002-roadmap-equipe-marketing-autonoma](../../bdrs/product/plans/002-roadmap-equipe-marketing-autonoma.md) - Fase 1, que origina esta decisão
- [_local-edr-policy-001-tdd-obrigatoria](../principles/001-tdd.md) - Teste que verifica a ausência de dado bruto no objeto persistido
