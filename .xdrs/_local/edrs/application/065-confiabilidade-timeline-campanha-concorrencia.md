---
name: _local-edr-policy-065-confiabilidade-da-timeline-de-campanha
description: Dois bugs reais de produção na mesma investigação — legenda de campanha caindo 100% em fallback por rajada de chamadas simultâneas ao generator-service, e exclusão de foto quebrando com 5 NOT_FOUND ao colidir com reordenação por arraste. Use ao investigar falhas na geração da linha do tempo ou na exclusão/reordenação de fotos de campanha.
apply-to: apps/api — GenerateCampaignTimelineUseCase, ExtendCampaignTimelineUseCase, FirestoreCampaignPhotoRepository; apps/web — tela de upload de campanha
valid-from: 2026-07-22
---

# _local-edr-policy-065: Confiabilidade da Timeline de Campanha

## Context and Problem Statement

Usuário reportou, em campanhas novas e antigas, todo item da linha do tempo saindo com a mesma legenda genérica — e, à parte, um erro `5 NOT_FOUND: No document to update` ao excluir uma foto de campanha. As duas investigações aconteceram na mesma sessão de trabalho e mudam o mesmo fluxo de campanha; documentadas juntas.

## Decision Outcome

**Legenda: concorrência das chamadas de IA por item passa a ser limitada (`CAPTION_CONCURRENCY = 3`), em vez de disparar uma chamada por item simultaneamente via `Promise.all`. Exclusão: `FirestoreCampaignPhotoRepository.reorder` checa existência de cada documento (`getAll`) antes do `batch.update`, pulando ids que já não existem em vez de derrubar o lote inteiro.**

### Details

**Bug 1 — rajada de chamadas simultâneas devolvia 503 puro do Cloud Run**

`generator-service` roda com `max-instances=2` (`.github/workflows/deploy.yml`). `GenerateCampaignTimelineUseCase`/`ExtendCampaignTimelineUseCase` disparavam uma chamada de legenda por IA por item, todas em paralelo — uma campanha com dezenas de itens (ex: 173 fotos ÷ 5 = ~35 itens) lançava ~35 requisições simultâneas contra um serviço sem capacidade para isso. A maioria voltava `503 Service Unavailable` **sem corpo JSON** — sinal de que a rejeição era do próprio Cloud Run, nunca chegando na rota. Diagnosticado ao vivo com um marcador de debug temporário (`[DEBUG-IA: <erro>]`) embutido na legenda de fallback, visível só na tela de revisão — usado porque não havia acesso a Cloud Logging nesta investigação; revertido assim que a causa foi confirmada.

Correção: `mapWithConcurrency` (`apps/api/src/use-cases/campaigns/mapWithConcurrency.ts`) roda no máximo `CAPTION_CONCURRENCY` (3) chamadas em voo ao mesmo tempo, preservando ordem e o isolamento de falha por item já existente (`_local-edr-policy-048`). Este bug é anterior a qualquer mudança desta sessão — explica a queixa original do usuário de que a legenda nunca refletia a foto.

**Bug 2 — exclusão de foto colidindo com reordenação por arraste**

`reorder()` montava `batch.update()` para cada id recebido — `.update()` exige que o documento já exista, senão o lote inteiro falha. No frontend, `handlePointerUp` (arraste de reordenar) disparava `reorderPhotos.mutate` em **qualquer** `pointerup` que seguisse um `pointerdown` na miniatura, mesmo sem arraste real (um toque simples já bastava, já que só o botão de excluir tem `stopPropagation`). Isso abria uma janela onde uma exclusão quase simultânea incluía o id já apagado no lote de reordenação.

Correção dupla: `reorder()` busca a existência de todos os documentos via `getAll()` antes do batch e pula os que não existem mais (defesa robusta, independente do cliente); `handlePointerUp` só chama `reorderPhotos.mutate` quando a ordem de fato mudou em relação à última ordem conhecida do servidor.

## References

- [_local-edr-policy-048-legenda-de-campanha-por-ia](048-legenda-de-campanha-por-ia.md) - Isolamento de falha por item que este fix preserva
- [_local-edr-policy-047-plataforma-e-fuso-do-contador](047-plataforma-e-fuso-do-contador.md) - Precedente de bug real de produção diagnosticado sem acesso direto a GCP/Firestore
- [_local-edr-policy-052-lock-contra-corrida-na-linha-do-tempo](052-lock-contra-corrida-na-linha-do-tempo.md) - Outra corrida de concorrência na mesma área de código
