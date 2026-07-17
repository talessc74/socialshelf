---
name: _local-edr-policy-052-lock-contra-corrida-na-linha-do-tempo
description: CampaignTimelineLockRepository — lock advisório (transação Firestore num doc dedicado, TTL 2min) contra chamadas concorrentes de Generate/Extend/ActivateCampaignTimelineUseCase. Sem isso, duas chamadas simultâneas liam o mesmo estado "antes" da linha do tempo e cada uma agendava a mesma foto num CampaignItem diferente. Use ao mexer em qualquer um desses três use cases ou em CampaignTimelineLockRepository.
apply-to: apps/api — GenerateCampaignTimelineUseCase, ExtendCampaignTimelineUseCase, ActivateCampaignUseCase, FirestoreCampaignTimelineLockRepository; packages/domain — CampaignTimelineLockRepository
valid-from: 2026-07-17
---

# _local-edr-policy-052: Lock contra corrida na linha do tempo

## Context and Problem Statement

Usuário reportou (com print de tela) fotos idênticas se repetindo em posts adjacentes de uma
campanha `active` — a mesma foto de capa aparecendo em dois carrosséis diferentes, agendados em
horários consecutivos. Como cada `CampaignItem` deveria referenciar um conjunto disjunto de
`CampaignPhoto`, isso só é possível se a mesma foto tiver sido agendada em duas execuções
diferentes de `ExtendCampaignTimelineUseCase` (o use case introduzido em `_local-edr-policy-050`
pra agendar fotos novas numa campanha já `active`).

Investigação do código confirmou o mecanismo: `execute()` lê `existingItems` via
`itemRepo.findByCampaign`, calcula `scheduledPhotoIds` (união de `photoIds` de todos os itens
existentes) e trata qualquer foto fora desse conjunto como "nova". Nada impedia duas chamadas
concorrentes (duplo clique em "Agendar fotos novas", retry de rede, duas abas) de ler o mesmo
snapshot de `existingItems` **antes** de qualquer uma delas persistir — ambas calculavam
`scheduledPhotoIds` desatualizado, tratavam as mesmas fotos como "novas" e cada uma criava um
`CampaignItem` novo e diferente contendo essas fotos. O padrão de sobreposição parcial
observado no print (2 de 5 fotos repetidas entre posts adjacentes) é consistente com uploads
ainda em andamento entre as duas chamadas concorrentes, deslocando os limites do agrupamento.

O mesmo risco existia, por construção idêntica (ler tudo, computar, escrever tudo), em
`GenerateCampaignTimelineUseCase` (concorrência consigo mesma, ou com `Extend`, mexendo na
mesma coleção `items`) e em `ActivateCampaignUseCase` (duplo clique em "Ativar campanha"
materializaria os mesmos itens duas vezes, criando dois `Post` reais pra mesma foto).

## Decision Outcome

**`CampaignTimelineLockRepository`: lock advisório por campanha, adquirido no início da execução
e liberado em `finally`, usado pelos três use cases que leem-então-escrevem a mesma coleção de
`CampaignItem`.**

### Details

**Doc dedicado (`_locks/timeline`), não um campo em `PhotoCampaign`**

Adicionar um campo de lock à entidade `PhotoCampaign` exigiria atualizar todo fixture de teste
que já constrói esse objeto (dezenas de arquivos, em `apps/api` e `apps/web`) só pra carregar um
detalhe de implementação que nenhuma tela usa. Um subdocumento Firestore isolado
(`users/{u}/brands/{b}/photo_campaigns/{c}/_locks/timeline`) resolve o mesmo problema sem tocar
na entidade nem em nenhum fixture existente — `CampaignTimelineLockRepository` é uma porta nova e
pequena (`tryAcquire`/`release`), implementada com o mesmo `db.runTransaction` já usado por
`FirestorePostRepository.claimForPublishing` pra resolver exatamente essa classe de problema
(corrida entre leituras e escritas concorrentes).

**TTL de 2 minutos, não um lock permanente**

Se o processo cair (crash, timeout) no meio de uma execução com o lock adquirido, um lock
permanente travaria a campanha pra sempre. `tryAcquire` considera o lock livre se o
`acquiredAt` registrado tem mais de 2 minutos — generoso o bastante pra cobrir o pior caso real
(materializar vários itens, cada um com uma chamada de legenda por IA ao generator-service), mas
curto o bastante pra se autorecuperar sozinho.

**`finally` garante liberação mesmo em erro**

As três chamadas (`GenerateCampaignTimelineUseCase.execute`, `ExtendCampaignTimelineUseCase.execute`,
`ActivateCampaignUseCase.execute`) adquirem o lock logo após validar o `status` da campanha, e
liberam em `finally` — uma falha no meio (ex: `captionClient` fora do ar, foto referenciada não
encontrada) nunca deixa o lock preso.

**409 no HTTP, não 422**

`statusForCampaignError` em `campaigns.routes.ts` mapeia a mensagem "already in progress" pra
409 (Conflict) nas três rotas (`/timeline/generate`, `/timeline/extend`, `/activate`) — sinaliza
ao cliente que a operação pode ser tentada de novo, diferente de um 422 de violação de regra de
negócio permanente (ex: status errado pra essa ação).

## What this does not solve

Não corrige retroativamente dados já duplicados por essa corrida antes do fix — campanhas que já
têm `CampaignItem`s (ou `Post`s materializados) com fotos repetidas precisam de limpeza manual
via a tela de Posts Agendados (editar/cancelar o post duplicado), sem ferramenta de deduplicação
automática. Sem teste de integração reproduzindo a corrida de verdade (duas chamadas HTTP
concorrentes) — a cobertura é por unit test verificando que `tryAcquire` retornando `false`
interrompe a execução antes de qualquer leitura/escrita, o que garante a proteção mas não simula
o timing exato do bug original.

## References

- [_local-edr-policy-050-campanha-aceita-fotos-sempre](050-campanha-aceita-fotos-sempre.md) - Introduziu ExtendCampaignTimelineUseCase, onde a corrida foi observada em produção
- [_local-edr-policy-039-campanha-de-fotos-implementacao-fase-1](039-campanha-de-fotos-implementacao.md) - ActivateCampaignUseCase original, também protegido por este lock
