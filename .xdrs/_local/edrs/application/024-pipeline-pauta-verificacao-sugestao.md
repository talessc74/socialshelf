---
name: _local-edr-policy-024-pipeline-de-pauta-verificacao-e-sugestao
description: Define como notícia bruta é ingerida, verificada por domínio de fonte e combinada com sinal de audiência para gerar TopicSuggestion. Use ao implementar SuggestTopicsUseCase, adapters de notícia, ou o proxy api → generator para /pauta-suggestions.
apply-to: apps/generator — lib/factVerification, infrastructure/news, SuggestTopicsUseCase; apps/api — pauta.routes
valid-from: 2026-06-19
---

# _local-edr-policy-024: Pipeline de Pauta — Verificação e Sugestão

## Context and Problem Statement

[_local-adr-policy-027-pauta-localizacao-e-verificacao-factual](../../adrs/application/027-pauta-localizacao-e-verificacao-factual.md) decide que o pipeline de pauta vive em `generator` e que uma notícia só é verificada se sua URL resolve para um domínio confiável cadastrado. Falta definir, no nível de implementação, como a verificação se encaixa entre a ingestão e a sugestão de forma que nenhuma notícia não-verificada chegue ao motor de sugestão, e como o sinal de audiência da Fase 1 entra no cálculo de relevância.

## Decision Outcome

**`SuggestTopicsUseCase` filtra a lista bruta de notícias por `verifyNewsItem()` antes de qualquer outro processamento — o motor de sugestão nunca itera sobre `NewsItem`, apenas sobre `VerifiedNewsItem`.**

```typescript
const rawNews = await this.newsSource.fetchNews(brandProfile.business.segment)
const verifiedNews = rawNews
  .map((item) => verifyNewsItem(item, this.trustedDomains))
  .filter((item): item is VerifiedNewsItem => item !== null)

// a partir daqui, somente itens verificados existem no escopo
const suggestions = verifiedNews.map((item) => this.buildSuggestion(brandId, item, ...))
```

### Details

**Ingestão segue o mesmo padrão hexagonal da Fase 1**

`NewsSourcePort.fetchNews(segment): Promise<NewsItem[]>` é a porta (domain); `NewsApiOrgReader` é o único adapter hoje, em `apps/generator/src/infrastructure/news/`, paralelo a `infrastructure/analytics/` da Fase 1 — uma chamada HTTP real a uma API de notícia, mockada via `vi.stubGlobal('fetch', ...)` nos testes, sem token OAuth de usuário envolvido.

**Verificação é uma função pura, não um serviço com estado**

`verifyNewsItem(item, trustedDomains): VerifiedNewsItem | null` em `apps/generator/src/lib/factVerification.ts` não depende de I/O — recebe a lista de domínios confiáveis já resolvida (via `getTrustedDomains()`, que lê `TRUSTED_NEWS_DOMAINS` ou usa um padrão). Isso torna a regra testável sem mocks de rede: URL com domínio confiável passa, URL com domínio não-listado é descartada, URL com protocolo não-https é descartada, URL malformada é descartada.

**Sinal de audiência entra como multiplicador, não como filtro**

`SuggestTopicsUseCase` calcula `avgEngagementRate` lendo `AudienceSignalRepository.findLatestByBrandAndPlatform()` para todas as plataformas (`ALL_PLATFORMS`) e tirando a média das que existem — ausência de sinal (brand ainda não publicou em nenhuma plataforma) resulta em `0`, nunca em erro. O score de cada sugestão é `temasCorrespondentes * (1 + avgEngagementRate)`: notícia sem correspondência com os temas recorrentes da marca tem score `0` e ainda é retornada (com `rationale` explicando a ausência de correspondência), mas fica no fim da lista ordenada.

**`generator` lê BrandProfile e AudienceSignal com seu próprio repositório Firestore**

Assim como `api` e `publisher` já implementam, cada um, sua própria classe `FirestoreOAuthRepository`/`FirestorePostRepository` para o mesmo dado compartilhado ([_local-adr-policy-004](../../adrs/application/004-service-decomposition.md) só proíbe importar código de app para app, não proíbe cada serviço ler a mesma coleção Firestore), `generator` ganha `FirestoreBrandProfileRepository` e `FirestoreAudienceSignalRepository` próprios — cópias read-focused dos mesmos contratos já usados em `api` e `publisher`, sem introduzir uma chamada de serviço para serviço.

**Proxy `api → generator` reutiliza o padrão de `/audience-signal`**

`apps/api/src/routes/pauta.routes.ts` expõe `GET /pauta-suggestions` autenticado por Firebase, fazendo `POST {GENERATOR_URL}/pauta/suggest` com `X-Internal-Secret` e `request.userId` como `brandId` — mesmo padrão de proxy que `audience-signal.routes.ts` já usa para `publisher`.

**O que isso não resolve**

Limite de quantas sugestões persistir por execução (hoje todas as notícias verificadas geram uma `TopicSuggestion`) e deduplicação de notícias já sugeridas em execuções anteriores são decisões de fase futura, fora do escopo da Fase 2.

## References

- [_local-adr-policy-027-pauta-localizacao-e-verificacao-factual](../../adrs/application/027-pauta-localizacao-e-verificacao-factual.md) - Decisão estrutural que este EDR implementa
- [_local-edr-policy-023-pipeline-sinal-audiencia-sem-retencao](023-pipeline-sinal-audiencia.md) - Padrão hexagonal de adapter reaplicado para ingestão de notícia
- [_local-bdr-plan-002-roadmap-equipe-marketing-autonoma](../../bdrs/product/plans/002-roadmap-equipe-marketing-autonoma.md) - Fase 2, que origina esta decisão
- [_local-edr-policy-001-tdd-obrigatoria](../principles/001-tdd.md) - Testes que garantem que notícia não-verificada nunca gera sugestão
