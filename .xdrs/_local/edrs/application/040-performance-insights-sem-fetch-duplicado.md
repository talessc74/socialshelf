---
name: _local-edr-policy-040-performance-sem-fetch-duplicado
description: POST /performance-insights (api-service) recebe as entradas já buscadas pela tela em vez de buscar de novo no publisher, eliminando uma segunda rodada de chamadas ao vivo para Meta/X/LinkedIn a cada carregamento da tela de Performance. Use ao mexer no fluxo de diagnóstico de performance ou ao investigar custo/latência da tela /dashboard/performance.
apply-to: apps/api — rota /performance-insights; apps/web — /dashboard/performance
valid-from: 2026-07-10
---

# _local-edr-policy-040: Performance Sem Fetch Duplicado

## Context and Problem Statement

Uma revisão da seção de Performance encontrou que toda visita a `/dashboard/performance` pagava, no mínimo, duas rodadas completas de chamadas ao vivo para as APIs de Meta/X/LinkedIn: uma para popular a tela (`GET /posts-performance`) e outra embutida dentro do diagnóstico automático de IA que dispara sozinho assim que a tela carrega (`GET /performance-insights`, que internamente repetia a mesma busca no publisher antes de mandar pro Gemini). Como reaproveitar dados que a própria tela já buscou segundos antes, sem inventar uma camada de cache nova?

## Decision Outcome

**`POST /performance-insights` (api-service) passa a receber as `entries` já buscadas pelo cliente no corpo da requisição, em vez de rebuscar no publisher — o cliente é o único consumidor desta rota, então o contrato virou obrigatório em vez de opcional.**

### Details

**Por que o cliente manda os dados em vez de o servidor cachear**

Não existe cache de resposta HTTP nem camada de memoização nova em lugar nenhum do pipeline — a rota simplesmente para de rebuscar o que o chamador já tem. É a solução mais simples possível pro problema real (o mesmo carregamento de tela busca a mesma coisa duas vezes), sem introduzir invalidação de cache, TTL, ou estado compartilhado entre requisições.

**`GET` virou `POST`**

`/performance-insights` precisava de corpo (as `entries`), então virou `POST` — o único chamador (`apps/web/src/app/dashboard/performance/page.tsx`) foi atualizado junto. `GET /performance-insights/latest` não muda: já não fazia nenhuma busca redundante, só lê o último diagnóstico persistido.

**`/performance-suggestions` (tela separada `/dashboard/insights`) não foi tocada**

Essa rota também rebusca `/posts-performance` no publisher, mas em uma página diferente, sem acesso às `entries` que a tela de Performance já carregou — não há dado "já buscado" pra reaproveitar ali sem uma mudança maior (ex: compartilhar cache do React Query entre rotas, ou navegar levando os dados junto). Fica fora do escopo desta correção; a rota mantém seu único fetch por visita explícita à aba "Novas sugestões".

**Validação zod adicionada nesta rota**

A rota não tinha `safeParse` (lacuna encontrada na mesma revisão, junto com `posts-performance.routes.ts` e `performance-suggestions.routes.ts`, que continuam sem validação — fora do escopo desta correção pontual). `POST /performance-insights` ganhou o schema espelhando exatamente o que `apps/generator/src/routes/performance-insights.routes.ts` já validava, então uma entrada malformada é rejeitada com 400 antes mesmo de sair do api-service.

## What this does not solve

`/performance-suggestions` continua rebuscando `/posts-performance` a cada visita à aba "Novas sugestões" de `/dashboard/insights` — sem dado já carregado pra reaproveitar naquela tela. `posts-performance.routes.ts` e `performance-suggestions.routes.ts` continuam sem validação zod. TikTok continua sem `AnalyticsReaderPort` (posts do TikTok não aparecem nem como erro na tela de Performance). `XAnalyticsReader` continua sem tratar post apagado como `ContentNotFoundError` (só `MetaAnalyticsReader` trata isso hoje).

## References

- [_local-edr-policy-023-pipeline-sinal-audiencia-sem-retencao](023-pipeline-sinal-audiencia.md) - Mesmo espírito de não reter dado bruto além do necessário, aplicado aqui a não buscar de novo o que já foi buscado
