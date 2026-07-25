---
name: _local-edr-policy-069-descartar-campanha-cancelada
description: Botão "Descartar" para campanhas 'cancelled' — DiscardCampaignUseCase apaga o documento da campanha, seus CampaignItem e CampaignPhoto, e os blobs de foto ainda não usados em nenhum post real, tudo sob demanda em vez de esperar os 7 dias do tick automático (_local-edr-policy-067). Mesmo invariante de segurança de CleanupCancelledCampaignPhotosUseCase: nunca apaga o blob de uma foto cujo CampaignItem ficou 'materialized' (referenciado por um Post real). Diálogo de confirmação avisa o que vai acontecer antes do usuário confirmar. Use ao mexer em DiscardCampaignUseCase, DELETE /campaigns/:id, ou no botão "Descartar" de dashboard/campaigns/page.tsx.
apply-to: apps/api — DiscardCampaignUseCase, campaigns.routes.ts (DELETE /campaigns/:id), FirestorePhotoCampaignRepository.delete, FirestoreCampaignPhotoRepository.deleteByCampaign; apps/web — dashboard/campaigns/page.tsx; packages/domain — PhotoCampaignRepository.delete, CampaignPhotoRepository.deleteByCampaign
valid-from: 2026-07-25
---

# _local-edr-policy-069: Descartar campanha cancelada

## Context and Problem Statement

`_local-edr-policy-067` já apaga fotos de campanha cancelada automaticamente, mas só 7
dias depois do cancelamento — o documento da campanha em si nunca é apagado, fica pra
sempre como histórico. O usuário pediu uma forma de já tirar as fotos do site na hora,
sem esperar o prazo, e que a campanha suma por completo dos servidores (sem mais acesso
a ela) — não só o blob de imagem, tudo.

## Decision Outcome

**Botão "Descartar" só em campanhas `cancelled`; `DiscardCampaignUseCase` apaga
imediatamente o documento da campanha, seus `CampaignItem` e `CampaignPhoto`, e os blobs
de foto ainda não usados em nenhum post real — mesmo invariante de segurança da limpeza
automática, só que sob demanda e completo (não só o blob, os registros também).**

### Details

**Descartar é a versão sob demanda da limpeza automática, com um passo a mais**

`DiscardCampaignUseCase` reusa a mesma lógica de `CleanupCancelledCampaignPhotosUseCase`
pra decidir quais blobs apagar: cruza `CampaignItem.photoIds` dos itens ainda
`'materialized'` com as `CampaignPhoto` da campanha, e só apaga o blob das fotos de fora
desse conjunto. A diferença é o que acontece depois — a limpeza automática só marca
`photosDeletedAt` e preserva os documentos Firestore como histórico; descartar apaga
tudo: `CampaignItemRepository.deleteByCampaign`, o novo
`CampaignPhotoRepository.deleteByCampaign` (todos os registros de foto da campanha, não
só os apagáveis — protegidos ou não, o bookkeeping da campanha some de qualquer forma) e
por fim `PhotoCampaignRepository.delete` no documento da campanha.

**Por que apagar o registro de CampaignPhoto de uma foto protegida é seguro**

Uma vez que um `CampaignItem` materializa, `materializeCampaignItems` já copiou o
`storagePath` direto pro `Post.imageStoragePaths` — nada além do blob em si é
compartilhado entre `CampaignPhoto` e o `Post` real. Apagar o registro `CampaignPhoto`
(bookkeeping da campanha) não afeta o `Post` nem o blob que ele referencia; só o blob em
si precisa do cuidado de nunca ser tocado quando protegido.

**Falha em apagar um blob não bloqueia o descarte, mas perde a segunda chance**

Mesmo padrão *best-effort* de `DeleteCampaignPhotoUseCase` e da limpeza automática — uma
falha ao apagar um blob não impede o resto. A diferença aqui é que não há segunda
chance: a campanha (âncora da varredura automática de `_local-edr-policy-067`) deixa de
existir ao final do método, então um blob que falhar aqui fica órfão de vez, não só até o
próximo tick.

**Só campanhas `cancelled` podem ser descartadas**

`DiscardCampaignUseCase` rejeita qualquer outro status com `422`. No frontend, o botão
"Descartar" só aparece pra campanhas `cancelled` (`DISCARDABLE_STATUSES`), coerente com o
mesmo `statusForCampaignError` já usado por cancel/pause/resume/activate.

**Aviso explícito antes de confirmar**

O `confirm()` do botão avisa três coisas antes do usuário decidir: as fotos ainda não
usadas somem do armazenamento na hora (não em 7 dias), a campanha some por completo dos
servidores, e o usuário não tem mais acesso a ela — mesma filosofia de comunicação
proativa de `_local-edr-policy-067` (avisar o prazo antes do fato, não só depois).

## References

- [_local-edr-policy-067-retencao-e-limpeza-automatica-de-imagens](067-retencao-e-limpeza-automatica-de-imagens.md) - Limpeza automática que este EDR replica sob demanda, com o passo extra de apagar os registros Firestore
- [_local-edr-policy-059-pausar-retomar-e-cancelar-campanha-ativa](059-pausar-retomar-cancelar-campanha-ativa.md) - CancelCampaignUseCase e cancelPendingCampaignPosts garantem o invariante de que todo CampaignItem 'planned' após o cancelamento nunca aponta pra um Post real
