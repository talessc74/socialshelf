---
name: _local-edr-policy-050-campanha-aceita-fotos-sempre
description: Uma campanha aceita fotos novas a qualquer momento — em preparação (reviewing) ou já ativa publicando (active) — sem o regenerador destrutivo tocar em itens já materializados. Use ao mexer em GenerateCampaignTimelineUseCase, ExtendCampaignTimelineUseCase, ActivateCampaignUseCase, ou na tela de upload/lista de campanhas.
apply-to: apps/api — GenerateCampaignTimelineUseCase, ExtendCampaignTimelineUseCase, ActivateCampaignUseCase, materializeCampaignItems, campaignCaption; apps/web — dashboard/campaigns/page.tsx, dashboard/campaigns/[id]/upload/page.tsx
valid-from: 2026-07-15
---

# _local-edr-policy-050: Campanha aceita fotos sempre

## Context and Problem Statement

Usuário reportou que uma campanha só aceitava fotos durante `draft` — a tela de lista só linkava pra `/upload` nesse status, e mesmo se alguém chegasse lá por URL direta, o único caminho pra transformar fotos em linha do tempo era `GenerateCampaignTimelineUseCase`, que sempre `deleteByCampaign` + recria tudo do zero. Isso é seguro em `draft`/`reviewing` (nada foi materializado ainda), mas destruiria itens `materialized` — com `postId` real, possivelmente já publicado — de uma campanha `active`. Pedido explícito: aceitar fotos novas a qualquer momento, inclusive numa campanha já publicando.

## Decision Outcome

**Fotos novas em campanha `active` entram direto na fila de publicação (materializam em Post real na hora, sem passo de revisão extra) — escolha explícita do usuário entre isso e deixá-las pendentes de aprovação.**

### Details

**Novo use case `ExtendCampaignTimelineUseCase`, não uma variante de `GenerateCampaignTimelineUseCase`**

`GenerateCampaignTimelineUseCase` continua existindo e destrutivo (apaga tudo, reagrupa tudo) — ganhou só uma guarda (`campaign.status` precisa ser `draft` ou `reviewing`) pra nunca mais rodar contra uma campanha `active`. `ExtendCampaignTimelineUseCase` é aditivo: calcula quais fotos ainda não aparecem em nenhum `CampaignItem.photoIds` existente, clusteriza e agrupa só essas, e faz `itemRepo.saveAll` só dos itens novos — nunca `deleteByCampaign`. Os dois convivem porque resolvem problemas diferentes: gerar do zero (primeira vez, ou re-revisar antes de ativar) vs. anexar sem perturbar o que já existe.

**Cadência continua a partir do dia seguinte ao último item existente**

`computeScheduledTimes` recebe como `startDate` o dia seguinte ao `scheduledAt` mais recente entre os itens já existentes (ou agora, se a campanha ainda não tinha nenhum item). Não tenta preencher os slots restantes de um dia parcialmente ocupado — só evita colidir com o que já está agendado. Trade-off aceito: um dia com 1 de 2 slots usados não é completado antes de avançar pro dia seguinte.

**Materialização imediata em campanha `active`, sem revisão — escolha do usuário**

Perguntado explicitamente: itens novos numa campanha `active` viram Post real na hora (mesmo Post `status: 'scheduled'`, `origin: 'campaign'` de sempre) em vez de ficar `planned` aguardando aprovação manual. Reflete o pedido original ("mesmo já estiver ativa publicando") sem fricção extra — a campanha já está no automático, fotos novas só continuam o fluxo. Numa campanha ainda `reviewing`, os itens novos entram como `planned` (sem Post), consistentes com os itens já existentes que também não foram materializados.

**Duplicação extraída para `campaignCaption.ts` e `materializeCampaignItems.ts`**

`GenerateCampaignTimelineUseCase`, `ActivateCampaignUseCase` e `ExtendCampaignTimelineUseCase` agora compartilham a lógica de legenda por item (`captionForGroup`/`defaultCaption`) e de materializar um `CampaignItem` `planned` num `Post` real (`materializeCampaignItems`) — três call sites do mesmo comportamento deixariam de ser DRY sem essa extração.

## What this does not solve

Sem UI pra escolher, por campanha ou por upload, entre "publica direto" e "fica pendente de aprovação" — a decisão é fixa por status (`active` sempre materializa, `reviewing` sempre fica `planned`). Sem empacotamento retroativo de slots parcialmente ocupados no dia de transição. Fotos removidas depois de materializadas não têm caminho de "desagendar" um item já virado Post — seguem o fluxo normal de edição/cancelamento de post avulso.

## References

- [_local-edr-policy-039-campanha-de-fotos-implementacao-fase-1](039-campanha-de-fotos-implementacao.md) - `GenerateCampaignTimelineUseCase`, `ActivateCampaignUseCase` e o modelo `planned`/`materialized` que esta policy estende
- [_local-edr-policy-048-legenda-de-campanha-por-ia](048-legenda-de-campanha-por-ia.md) - Lógica de legenda por item (`captionForGroup`) agora extraída e compartilhada com `ExtendCampaignTimelineUseCase`
