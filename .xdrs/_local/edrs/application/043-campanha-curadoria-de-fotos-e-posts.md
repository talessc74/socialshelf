---
name: _local-edr-policy-043-campanha-curadoria-de-fotos-e-posts
description: Curadoria manual de campanha — reordenar/apagar fotos na tela de upload, e reordenar/mover-entre-posts/remover foto de um item já agrupado na tela de linha do tempo. Use ao mexer em CampaignPhoto.order, nos endpoints de fotos de campanha, ou nas telas de upload/timeline/lista de campanhas.
apply-to: packages/domain — CampaignPhoto, CampaignPhotoRepository; apps/api — infrastructure/firestore, routes/campaigns.routes.ts, use-cases/campaigns; apps/web — /dashboard/campaigns
valid-from: 2026-07-11
---

# _local-edr-policy-043: Campanha — Curadoria de Fotos e Posts

## Context and Problem Statement

Depois da revisão pós-saga do índice (`_local-edr-policy-042`), o usuário testou a campanha de 148 fotos e trouxe dois problemas de UX reais, não bugs: (1) o botão "Subir fotos" de um rascunho aparecia igual pra uma campanha vazia e pra uma que já tinha 148 fotos esperando a próxima etapa — a tela não tinha como saber a diferença; (2) a tela de linha do tempo (como os posts vão ser publicados) não tinha nenhuma edição além da legenda — sem jeito de reordenar fotos dentro de um carrossel, mover foto entre carrosséis, remover uma foto específica de um post, ou reordenar as fotos ainda na tela de upload antes de gerar a linha do tempo.

## Decision Outcome

**`CampaignPhoto` ganha um campo `order` opcional (nullable, sem migração de dado); a tela de upload ganha reordenar/apagar por foto; a tela de linha do tempo trata a campanha inteira como uma sequência única de fotos atravessando os posts, onde mover uma foto além da borda do post atual a "derrama" pro post vizinho — cobrindo reordenar dentro do carrossel e mover entre carrosséis com os mesmos dois botões; a lista de campanhas passa a mostrar quantas fotos cada rascunho já tem.**

### Details

**`order` é nullable e a query do Firestore continua ordenando por `createdAt` — sem migração**

Dado o histórico recente de bug de índice nessa mesma coleção (`_local-edr-policy-039`, `_local-edr-policy-042`), a prioridade era não arriscar quebrar `findByCampaign` de novo. Em vez de trocar a consulta pra `orderBy('order')` — o que faria toda foto já existente sem esse campo sumir da lista, já que o Firestore exclui documentos que não têm o campo usado no `orderBy` — a consulta continua exatamente como estava (`campaignId` + `createdAt`, já com índice `READY`), e a ordenação por `order` acontece em memória depois do fetch, com um comparador que trata `order: null` como "vai pro final, mas mantém a ordem relativa entre si" (sort estável do V8). Fotos novas (enviadas depois dessa feature) recebem um `order` real — a contagem atual da campanha via `CampaignPhotoRepository.countByCampaign` (nova query `.count()` agregada, escopo de coleção direta, sem risco de índice) — enviado uma vez por upload, não recalculado a cada requisição.

**Reordenar fotos afeta o agrupamento por localidade, não só a exibição**

`locationClustering.sortWithinCluster` (renomeado de `sortByCapturedTime`) passou a priorizar `order` sobre EXIF/`createdAt` quando ambas as fotos comparadas já têm um definido — sem isso, reordenar manualmente na tela de upload não mudaria em nada o carrossel sugerido por `GenerateCampaignTimelineUseCase`, já que o clustering usa sua própria ordenação interna. Essa é a única forma de o usuário controlar a sequência de fotos sem GPS/EXIF (ex: prints de tela — que é literalmente o caso da campanha de teste que motivou este pedido), já que aí não existe nenhum outro dado real pra ordenar por localidade ou data.

**Reordenar na tela de upload: setas, não arraste-e-solte**

Sem nenhuma lib de drag-and-drop no projeto, e testado num iPhone (drag-and-drop nativo HTML5 não funciona bem em touch sem polyfill), a solução foi um par de botões "‹"/"›" por miniatura que troca de posição com a vizinha e persiste via `PUT /campaigns/:id/photos/order` (novo endpoint, `CampaignPhotoRepository.reorder` grava o índice de cada foto na lista recebida). Mesmo raciocínio de robustez mobile-first já usado pro botão de apagar foto (sempre visível, não só no hover).

**Linha do tempo: uma sequência que atravessa os posts, não duas ações separadas**

O pedido original era "reordenar dentro do carrossel, mover foto entre carrosséis, deletar foto de um carrossel, colapsar carrossel pra uma foto única" — quatro capacidades. Em vez de quatro controles diferentes por miniatura (inviável em uma miniatura de 64px numa tela de celular), a linha do tempo inteira é tratada como uma única sequência de fotos: os mesmos botões "‹"/"›" reordenam dentro do post quando a foto ainda tem vizinho no mesmo post, e "derramam" a foto pro post anterior/seguinte quando ela já está na borda. Um "×" por miniatura remove a foto do post; se isso zera o post, ele desaparece da lista (o backend, `updateTimelineSchema`, já exige `photoIds.min(1)` — um post vazio nunca é uma opção válida). Reduzir um carrossel a uma foto única é só o caso de remover/mover fotos até sobrar 1 — não precisou de nenhuma ação nova. Todas essas edições mexem só no estado local da tela (mesmo padrão já usado pra legenda) — precisam do botão "Salvar alterações" pra persistir, reaproveitando 100% o `PUT /campaigns/:id/timeline` que já existia.

**Lista de campanhas: `photoCount` computado na rota, não persistido na campanha**

`GET /campaigns` agora busca a contagem de fotos de cada campanha (mesma query `.count()` agregada usada no upload) e anexa `photoCount` na resposta — não é um campo do domínio `PhotoCampaign`, só um enriquecimento ad hoc da rota, já que nenhum outro lugar do sistema precisa saber quantas fotos uma campanha tem. O botão de próximo passo troca de "Subir fotos" pra "Continuar upload" quando `photoCount > 0` num rascunho, e o card mostra a contagem.

**Reorder só é permitido em `draft`/`reviewing`**

`ReorderCampaignPhotosUseCase` bloqueia campanhas `active`/`completed`/`cancelled` — depois de ativada, as fotos já viraram `Post`s reais (`ActivateCampaignUseCase`), reordenar a lista de fotos da campanha não teria efeito nenhum sobre o que já foi materializado.

## What this does not solve

Sugestão automática de legenda via IA — o usuário pediu explicitamente, mas é uma integração nova com Gemini (prompt, endpoint, botão de "regerar"), escopo diferente de curadoria de UI; a legenda continua sendo o template simples (`_local-edr-policy-039`) até isso ser tratado como sua própria entrega. Mover uma foto pra um post que não é o vizinho imediato (ex: da posição 3 pra posição 47) ainda exige repetir o clique várias vezes — não existe input numérico de posição nem arraste-e-solte.

## References

- [_local-edr-policy-039-campanha-de-fotos-implementacao-fase-1](039-campanha-de-fotos-implementacao.md) - Implementação original; entidade `CampaignPhoto`, `locationClustering`, endpoints de foto
- [_local-edr-policy-042-campanha-revisao-pos-saga-do-indice](042-campanha-revisao-pos-saga-do-indice.md) - Revisão que motivou este pedido (`photoCount` resolve exatamente a ambiguidade de rótulo identificada ali)
