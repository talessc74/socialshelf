---
name: _local-adr-policy-027-pauta-localizacao-e-verificacao-factual
description: Define onde o motor de pauta (ingestão de notícia + sugestão) vive na arquitetura e a regra de verificação factual que toda notícia deve passar antes de alimentar uma sugestão. Use ao implementar qualquer ingestão de notícia ou geração de pauta.
apply-to: packages/domain — NewsItem, VerifiedNewsItem, TopicSuggestion; apps/generator — pauta
valid-from: 2026-06-19
---

# _local-adr-policy-027: Pauta — Localização e Verificação Factual

## Context and Problem Statement

A Fase 2 do roadmap ([_local-bdr-plan-002-roadmap-equipe-marketing-autonoma](../../bdrs/product/plans/002-roadmap-equipe-marketing-autonoma.md)) exige ingestão de notícia por nicho, verificação factual com fonte rastreável, e um motor de sugestão de pauta que casa notícia verificada com o `AudienceSignal` da Fase 1. O próprio plano marca como risco que "sugestão de pauta sem verificação factual gera desinformação em escala, sob a marca do usuário" e exige que "nenhuma pauta chegue à Fase 3 sem fonte rastreável associada" — decisão que precisa existir antes de qualquer ingestão real, na mesma lógica que já levou a registrar [_local-adr-policy-026](../controls/026-sinal-audiencia-minimizacao.md) antes da Fase 1.

Falta decidir duas coisas: (1) onde a ingestão de notícia e o motor de sugestão vivem na arquitetura de quatro serviços já estabelecida ([_local-adr-policy-004-decomposicao-de-servicos](004-service-decomposition.md)), e (2) qual é, em termos concretos e verificáveis, a regra de "fonte rastreável" que impede uma notícia não confiável de alimentar uma sugestão de pauta.

## Decision Outcome

**O pipeline de pauta (ingestão, verificação, sugestão) vive em `apps/generator`. Uma notícia só é considerada verificada se sua URL de origem resolve para um domínio confiável previamente cadastrado — caso contrário é descartada antes de chegar ao motor de sugestão.**

### Details

**Por que `generator`, não um quinto serviço, nem `api`**

`generator` já é o serviço responsável por produzir o insumo de conteúdo (cópia e imagem via Vertex AI) — pauta é a camada que antecede e alimenta essa geração, não uma responsabilidade nova e isolada. `generator` já chama APIs externas sem usar tokens OAuth de usuário (Vertex AI usa credencial de service account), o mesmo perfil de acesso que a ingestão de notícia precisa (chamada a uma API de notícia pública, sem token de plataforma social). Um quinto serviço duplicaria infraestrutura (Dockerfile, deploy, service account, IAM) sem isolar nenhum risco que `generator` já não isole. `api` não chama serviços externos de conteúdo diretamente — apenas faz proxy para `publisher`/`generator` via `INTERNAL_SECRET`, padrão que se mantém aqui.

**O que "fonte rastreável" significa em código**

```typescript
export function verifyNewsItem(item: NewsItem, trustedDomains: string[]): VerifiedNewsItem | null {
  const domain = extractDomain(item.sourceUrl) // null se a URL for inválida
  if (!domain) return null

  const isTrusted = trustedDomains.some(
    (trusted) => domain === trusted || domain.endsWith(`.${trusted}`),
  )
  if (!isTrusted) return null

  return { ...item, sourceDomain: domain, verifiedAt: new Date() }
}
```

A lista de domínios confiáveis é configurável via `TRUSTED_NEWS_DOMAINS` (env var, lista separada por vírgula), com um conjunto padrão de agências de notícia reconhecidas caso a variável não esteja definida. Uma notícia com URL malformada, ou cujo domínio não está na lista, nunca se torna uma `VerifiedNewsItem` — e `SuggestTopicsUseCase` só itera sobre itens já verificados, nunca sobre a lista bruta.

**Garantia em teste, não apenas em documentação**

Assim como a minimização de audiência (Fase 1) foi validada por um teste que inspeciona o objeto persistido, a verificação factual aqui é validada por testes que cobrem: URL de domínio confiável passa, URL de domínio não-confiável é descartada, URL malformada é descartada, e o motor de sugestão nunca recebe um item que `verifyNewsItem` rejeitou.

**O que isso não resolve**

Este ADR não avalia a qualidade jornalística ou o viés editorial da fonte — apenas garante que a fonte é rastreável (domínio identificável e pré-aprovado). Avaliação de viés ou checagem de fato byte-a-byte do conteúdo da notícia é fora de escopo da Fase 2.

## References

- [_local-bdr-plan-002-roadmap-equipe-marketing-autonoma](../../bdrs/product/plans/002-roadmap-equipe-marketing-autonoma.md) - Fase 2, que origina esta decisão
- [_local-adr-policy-004-decomposicao-de-servicos](004-service-decomposition.md) - Por que o pipeline vive em generator
- [_local-adr-policy-026-sinal-de-audiencia-minimizacao-e-leitura](../controls/026-sinal-audiencia-minimizacao.md) - Precedente de decisão estrutural registrada antes de ingestão real
