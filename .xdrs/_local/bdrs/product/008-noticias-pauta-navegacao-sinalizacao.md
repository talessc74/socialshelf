---
name: _local-bdr-policy-008-navegacao-e-sinalizacao-de-noticias
description: Define affordances de navegação e sinalização visual no fluxo de notícias para pauta — calendário como visão padrão de Agendamento, logo da fonte como fallback de thumbnail, selo de plataforma em notícia já publicada, e atalho de Notícias na home. Use ao revisar ou estender dashboard/scheduled, dashboard/insights, NewsCard ou os atalhos da home.
apply-to: apps/web — dashboard/scheduled, dashboard/insights, dashboard (home), components/NewsCard e NewsCarousel
valid-from: 2026-06-25
---

# _local-bdr-policy-008: Navegação e Sinalização de Notícias

## Context and Problem Statement

[_local-bdr-policy-001-principios-de-ux](../principles/001-ux-principles.md) estabelece Findability First na hierarquia de UX, mas decisões concretas de wayfinding e feedback visual no fluxo notícias-para-pauta — da home até a tela de Agendamento — ainda não tinham sido registradas. Quatro pontos de fricção foram identificados: a tela de Agendamento abria em lista mesmo quando o caso de uso mais comum é consultar uma data específica; notícia sem `og:image` mostrava um ícone genérico sem relação com a fonte; notícia já usada para gerar um post publicado não tinha marca distintiva, levando a reconsiderar a mesma notícia; e não havia atalho direto da home para a aba de Notícias do Banco de Insights.

## Decision Outcome

**Calendário como visão padrão de Agendamento, favicon da fonte como fallback de thumbnail, selo de plataforma em notícia já publicada, e atalho de Notícias na home.**

### Details

**Agendamento abre na visão de calendário**

`dashboard/scheduled/page.tsx` inicializa `view` como `'calendar'` em vez de `'list'`. O toggle Lista/Calendário continua disponível; a mudança afeta apenas o estado inicial.

**Favicon do domínio como fallback visual, nunca esticado como capa**

`NewsCard`/`NewsThumbnail` usa o serviço público de favicon (`https://www.google.com/s2/favicons?domain=<sourceDomain>&sz=64`) sobre o `sourceDomain` já exposto por `TopicSuggestion`, em vez do ícone genérico `Newspaper`, quando não há `thumbnailUrl`. O favicon é renderizado em tamanho fixo sobre o mesmo container de gradiente já usado no fallback — nunca esticado, o que distorceria um ícone pequeno e quadrado. Falha de carregamento (`onError`) reverte para o ícone `Newspaper` original.

**Selo de plataforma marca notícia já usada em post publicado**

A correspondência usa `articleUrl` (URL específica do artigo), não `sourceUrl` (domínio raiz do veículo, compartilhado por todas as notícias da mesma fonte) nem `TopicSuggestion.id` (gerado a cada execução da pauta, nunca estável entre atualizações). `apps/api/routes/pauta.routes.ts` anexa `publishedPlatforms: Platform[]` a cada sugestão recebida do gerador, cruzando contra os posts publicados da marca; `NewsCard` renderiza um selo por plataforma quando o array não está vazio, reaproveitando a tabela de cor/ícone por plataforma já usada em `dashboard/accounts`.

**Atalho de Notícias na home aponta direto para a aba**

`dashboard/page.tsx` ganha uma entrada em `SHORTCUTS` para `/dashboard/insights?tab=news`; `InsightsBankPage` lê `?tab=news` da URL para inicializar a aba ativa, em vez de sempre abrir em "Guardadas".

## What this does not solve

Correspondência de notícia publicada quando o link do artigo muda entre atualizações distantes da pauta (limitação aceita do uso de `articleUrl` como chave); troca entre múltiplas contas/produtos e cobrança recorrente seguem registrados como temas de discussão futura, sem decisão tomada aqui.

## References

- [_local-bdr-policy-001-principios-de-ux](../principles/001-ux-principles.md) - Findability First como princípio que origina estas decisões de navegação
- [_local-adr-policy-027-pauta-localizacao-e-verificacao-factual](../../adrs/application/027-pauta-localizacao-e-verificacao-factual.md) - TopicSuggestion e seus campos de origem (sourceDomain, sourceUrl)
- [_local-edr-policy-030-testes-de-componente-em-apps-web](../../edrs/application/030-testes-componente-web.md) - Padrão de teste de componente usado para cobrir a leitura de `?tab=news`
