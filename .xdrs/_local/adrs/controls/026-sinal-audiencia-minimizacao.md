---
name: _local-adr-policy-026-sinal-de-audiencia-minimizacao-e-leitura
description: Define o que pode ser retido sobre audiência (apenas sinal agregado) e onde a leitura de analytics por plataforma vive na arquitetura. Use ao implementar qualquer ingestão de métrica de rede social.
apply-to: packages/domain — AudienceSignal, AnalyticsReaderPort; apps/publisher — leitura de analytics
valid-from: 2026-06-19
---

# _local-adr-policy-026: Sinal de Audiência — Minimização e Leitura

## Context and Problem Statement

A Fase 1 do roadmap ([_local-bdr-plan-002-roadmap-equipe-marketing-autonoma](../../bdrs/product/plans/002-roadmap-equipe-marketing-autonoma.md)) exige escutar insights e audiência das redes conectadas para alimentar as fases seguintes (pauta, criação, operação). O próprio plano marca como risco que "ingestão de dado de audiência sem decisão de minimização prévia cria passivo de privacidade" e exige que essa decisão seja registrada como ADR antes de qualquer ingestão real.

Além da minimização, falta decidir onde a leitura de métricas de cada plataforma deve viver: [_local-adr-policy-004-decomposicao-de-servicos](../application/004-service-decomposition.md) já estabelece que `publisher` é o único serviço autorizado a chamar APIs externas de rede social com tokens armazenados — leitura de analytics é a mesma classe de chamada que publicação, apenas em direção contrária (GET em vez de POST).

Como decidir o que é seguro reter sobre audiência, e onde implementar a leitura sem violar a decomposição de serviços já estabelecida?

## Decision Outcome

**Apenas sinal agregado por marca+plataforma é persistido; métrica bruta por post nunca é persistida. Leitura de analytics vive em `apps/publisher`, mesmo serviço que já detém os tokens OAuth.**

### Details

**O que é retido**

```typescript
interface AudienceSignal {
  id: string
  brandId: string
  platform: Platform
  postsAnalyzed: number
  totalImpressions: number
  totalEngagements: number
  avgEngagementRate: number
  computedAt: Date
}
```

`AudienceSignal` é o único artefato persistido por este fluxo. Não existe coleção de métricas brutas por post, e não existe qualquer campo que identifique seguidores individuais (nome, handle, id de perfil, lista de quem engajou).

**O que nunca é retido**

- Identidade de seguidores ou de quem interagiu com um post (curtiu, comentou, compartilhou).
- Texto de comentários — apenas a contagem.
- Qualquer dado demográfico de audiência não fornecido como agregado pela própria API da plataforma.

**Pipeline de agregação sem retenção intermediária**

`AnalyticsReaderPort.fetchPostMetrics()` retorna métricas de um post (`impressions`, `likes`, `comments`, `shares`) lidas em tempo real da API da plataforma. `ComputeAudienceSignalUseCase` consome esse retorno em memória, soma nos totais e descarta — a métrica por post nunca chega a uma chamada de `repository.save()`. Apenas o agregado final é persistido.

**Recomputação, não edição**

Cada execução de `ComputeAudienceSignalUseCase` cria um novo documento `AudienceSignal` (novo `id`, `computedAt` atual) em vez de atualizar o anterior — mesma lógica de não-sobrescrita usada em [_local-adr-policy-025-brandprofile-schema-e-versionamento](../application/025-brand-profile-schema-versionamento.md), permitindo observar a evolução do sinal ao longo do tempo. `findLatestByBrandAndPlatform` lê o mais recente por `computedAt`.

**Onde a leitura vive**

`AnalyticsReaderPort` é a porta (domain); os adapters por plataforma (`LinkedInAnalyticsReader`, `MetaAnalyticsReader`, `XAnalyticsReader`) vivem em `apps/publisher/src/infrastructure/analytics/`, ao lado dos adapters de publicação (`LinkedInPublisher`, `MetaPublisher`, `XPublisher`), reusando o mesmo `TokenVaultPort` e o mesmo `OAuthRepository` já injetados nesse serviço. `apps/api` nunca chama a API de uma plataforma diretamente — apenas aciona o `publisher` via `INTERNAL_SECRET`, do mesmo jeito que já faz para `/publish`.

**Por que não um serviço de analytics separado**

Um quinto serviço duplicaria a posse de tokens OAuth (cofre, refresh, scopes) que já vive em `publisher`. Adicionar leitura ao serviço que já detém esse acesso é menor superfície de ataque do que replicar o acesso a tokens em outro serviço.

## References

- [_local-bdr-plan-002-roadmap-equipe-marketing-autonoma](../../bdrs/product/plans/002-roadmap-equipe-marketing-autonoma.md) - Fase 1, que origina esta decisão
- [_local-adr-policy-004-decomposicao-de-servicos](../application/004-service-decomposition.md) - Por que a leitura vive em publisher, não em api
- [_local-adr-policy-006-dados-como-passivo-minimizacao](006-data-minimization.md) - Princípio de minimização aplicado aqui
- [_local-adr-policy-025-brandprofile-schema-e-versionamento](../application/025-brand-profile-schema-versionamento.md) - Padrão de não-sobrescrita reaplicado em AudienceSignal
