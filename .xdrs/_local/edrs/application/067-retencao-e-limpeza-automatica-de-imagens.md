---
name: _local-edr-policy-067-retencao-e-limpeza-automatica-de-imagens
description: Bucket de imagens crescia sem limite — nenhuma imagem de post publicado ou de campanha cancelada era apagada automaticamente. Tick diário em api-service (/internal/storage-cleanup-tick, Cloud Scheduler) apaga imagens de posts publicados 7 dias após publishedAt e fotos de campanha cancelada 7 dias após o cancelamento, nunca tocando fotos ainda referenciadas por um Post real (CampaignItem 'materialized'). Post.imagesDeletedAt e PhotoCampaign.photosDeletedAt marcam o que já foi apagado, sem remover os documentos do Firestore. Use ao mexer em CleanupPublishedPostImagesUseCase, CleanupCancelledCampaignPhotosUseCase, ou nos prazos exibidos na tela de publicados e nos diálogos de cancelamento de campanha.
apply-to: apps/api — CleanupPublishedPostImagesUseCase, CleanupCancelledCampaignPhotosUseCase, storage-cleanup.routes.ts, FirestorePostRepository, FirestorePhotoCampaignRepository; apps/web — dashboard/scheduled/page.tsx, dashboard/campaigns/*; packages/domain — Post.imagesDeletedAt, PhotoCampaign.photosDeletedAt, StorageRetention.ts; .github/workflows/deploy.yml — Cloud Scheduler job api-storage-cleanup-tick
valid-from: 2026-07-25
---

# _local-edr-policy-067: Retenção e limpeza automática de imagens

## Context and Problem Statement

`_local-adr-policy-008` (retenção e privacidade de dados) já definia 7 dias de retenção
para "Uploads do usuário" (vídeo, `_local-edr-policy-034`), mas deixava em aberto a
linha "Imagens geradas": nem prazo, nem regra de deleção definidos. Na prática, nenhuma
imagem de post publicado ou de foto de campanha cancelada era apagada do Cloud Storage
em momento algum — o bucket só cresce, sem limite, sem monitoramento de custo.

Pedido explícito: deixar claro pro usuário, com prazo definido e comunicado
proativamente, quando as imagens somem — tanto para posts publicados quanto para
campanhas canceladas — e proteger o armazenamento contra esse crescimento ilimitado.

## Decision Outcome

**Tick diário no api-service apaga imagens de posts publicados e fotos de campanha
cancelada 7 dias após o evento que inicia a contagem, preservando qualquer blob ainda
referenciado por um Post real. Prazo comunicado proativamente na tela de publicados e
nos diálogos de cancelamento de campanha, com o mesmo número usado pelo backend.**

### Details

**Dois relógios, mesma janela de 7 dias (`packages/domain/src/value-objects/StorageRetention.ts`)**

`PUBLISHED_POST_IMAGE_RETENTION_DAYS` e `CANCELLED_CAMPAIGN_PHOTO_RETENTION_DAYS`
começam ambos em 7 — mesmo prazo já em uso por `_local-edr-policy-034` (vídeo) e pela
linha "Uploads do usuário" de `_local-adr-policy-008`, sem introduzir um terceiro
número pro usuário memorizar. Exportado por `packages/domain` porque tanto o backend
(que executa a limpeza) quanto o frontend (que mostra o prazo) precisam do mesmo valor
— nunca hardcoded duas vezes.

**Post publicado: `imagesDeletedAt` marca, não apaga o histórico**

`CleanupPublishedPostImagesUseCase` (`apps/api`) busca posts `status: 'published'` com
`publishedAt` mais antigo que o cutoff e `imagesDeletedAt: null`
(`PostRepository.findPublishedForImageCleanup`). Para cada um, apaga todo
`imageStoragePaths` via `POST /images/delete` no generator-service (mesma chamada que
`DeleteCampaignPhotoUseCase` já usa) e grava `imagesDeletedAt: new Date()` — o
documento do Post continua existindo (é o histórico do que foi publicado), só o blob
some. Falha ao apagar um blob não impede a marcação nem os próximos posts; é
reportada no resultado do tick, não engolida.

**Campanha cancelada: só apaga foto que nunca virou Post real**

`CleanupCancelledCampaignPhotosUseCase` busca campanhas `status: 'cancelled'` com
`updatedAt` (o momento do cancelamento — `_local-edr-policy-059`) mais antigo que o
cutoff e `photosDeletedAt: null`. Para cada campanha, cruza `CampaignItem.photoIds` dos
itens ainda `'materialized'` com as `CampaignPhoto` da campanha — só as fotos de fora
desse conjunto são apagadas. Isto é necessário porque `materializeCampaignItems`
reaproveita o mesmo `storagePath` do `CampaignPhoto` diretamente no `Post.
imageStoragePaths` (sem copiar o arquivo); uma foto de item `'materialized'` é o mesmo
blob referenciado por um Post já publicado, publicando ou aguardando publicação —
apagar ali por baixo dos panos quebraria esse post. `cancelPendingCampaignPosts`
(`_local-edr-policy-059`) já garante que todo item ainda `'planned'` no momento do
cancelamento nunca teve (ou não tem mais) um Post real apontando pro seu storagePath —
é exatamente esse subconjunto que a limpeza apaga.

**Um único tick, dois relógios independentes**

`POST /internal/storage-cleanup-tick` (novo, `apps/api`) roda as duas limpezas na
mesma chamada — mesmo padrão de autenticação (`X-Internal-Secret` + OIDC) do
`/internal/videos-cleanup-tick` já existente no generator-service. Cloud Scheduler
(`api-storage-cleanup-tick`, diário) aciona o tick; `deploy.yml` ganhou o passo
`id: deploy` que faltava no job `deploy-api` (necessário pra capturar a URL do serviço
e apontar o Scheduler pra ela, mesmo padrão dos outros três jobs de deploy).

**Comunicação proativa, não só reativa**

Tela de publicados (`dashboard/scheduled/page.tsx`): cada post com imagem mostra
"a imagem será removida em N dias" enquanto o blob existe, e um placeholder "Imagem
removida" (sem tentar buscar signed URL) quando `imagesDeletedAt` já está preenchido.
Diálogos de cancelamento de campanha (`dashboard/campaigns/page.tsx`,
`[id]/timeline/page.tsx`, `[id]/upload/page.tsx`): o `confirm()` de cancelar passa a
avisar que fotos ainda não usadas serão apagadas em 7 dias, antes do usuário confirmar
— não depois.

## What this does not solve

Não define prazo para "GenerationRequests" (`_local-adr-policy-008` também deixava essa
linha em aberto) — fora de escopo deste EDR, que resolve só a linha "Imagens geradas".
Não oferece um botão de "baixar antes de apagar" como a retenção de vídeo do usuário
oferece (`_local-edr-policy-034`) — imagem gerada/de campanha é conteúdo do próprio
SocialShelf, não upload de terceiro, então o mesmo cuidado de preservar uma cópia pro
usuário baixar não se aplica com a mesma urgência; pode ser revisitado se um usuário
pedir. Não apaga fotos de campanha `'draft'`/`'reviewing'` nunca ativadas e depois
esquecidas — só campanhas que passaram por `'cancelled'` entram nesta limpeza.

## References

- [_local-adr-policy-008-retencao-e-privacidade-de-dados](../../adrs/data/008-data-retention-privacy.md) - Deixava "Imagens geradas" em aberto; resolvido por este EDR
- [_local-edr-policy-034-consentimento-de-terceiros-no-upload](034-consentimento-conteudo-terceiros-upload.md) - Precedente direto: mesmo padrão de tick diário + Cloud Scheduler + retenção de 7 dias, para vídeo
- [_local-edr-policy-059-pausar-retomar-cancelar-campanha-ativa](059-pausar-retomar-cancelar-campanha-ativa.md) - cancelPendingCampaignPosts garante o invariante de segurança que este EDR depende: item 'planned' após cancelamento nunca aponta pra um Post real
