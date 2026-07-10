---
name: _local-edr-policy-039-campanha-de-fotos-implementacao-fase-1
description: Implementação da Fase 1 da campanha de fotos (_local-adr-policy-041) — entidades PhotoCampaign/CampaignPhoto/CampaignItem, extração de EXIF/GPS, clustering por localidade, sugestão de carrossel, e materialização em Post. Use ao mexer em qualquer peça do fluxo de campanha ou investigar por que o agrupamento/agendamento saiu diferente do esperado.
apply-to: packages/domain — entidades e ports; apps/api — infrastructure/exif, use-cases/campaigns, routes/campaigns; apps/web — /dashboard/campaigns
valid-from: 2026-07-10
---

# _local-edr-policy-039: Campanha de Fotos — Implementação (Fase 1)

## Context and Problem Statement

`_local-adr-policy-041` decide materializar itens de campanha como `Post` normais. Como implementar concretamente o agrupamento por localidade, a sugestão de carrossel respeitando o teto de cada rede, e o pacing dos horários, sem inventar abstração nova onde uma função pura já resolve?

## Decision Outcome

**Três entidades novas em `packages/domain` (`PhotoCampaign`, `CampaignPhoto`, `CampaignItem`) com ports próprios; extração de EXIF/GPS e o algoritmo de clustering ficam como funções puras em `apps/api`, sem porta de domínio — não há chamada externa nem necessidade de mock em teste que justifique a abstração.**

### Details

**EXIF/GPS extraído no api-service, não em generator-service**

O upload de foto de campanha (`POST /campaigns/:id/photos`) chega no api-service via multipart (um arquivo por requisição, mesmo teto de `files: 1` já configurado em `app.ts` pro upload de imagem manual). O buffer já está em memória ali — `extractPhotoMetadata` (`apps/api/src/infrastructure/exif/`, usando a lib `exifr`) roda antes de encaminhar o arquivo pro storage. Fotos sem EXIF (screenshot, imagem editada) não derrubam o upload — só ficam sem localização/data, caindo no cluster `NO_LOCATION_CLUSTER_ID`.

**Armazenamento reaproveita o `/images/upload` do generator-service que já existe**

`UploadCampaignPhotoUseCase` chama o mesmo endpoint interno (`POST /images/upload`, `GcsImageStorage`) já usado pelo upload de imagem manual — zero código novo de storage. `CampaignPhoto.storagePath` é só o retorno desse endpoint mais os metadados extraídos localmente.

**Clustering por localidade: single-linkage guloso por distância haversine, raio de 150m**

`clusterByLocation` (`apps/api/src/use-cases/campaigns/locationClustering.ts`) não usa k-means nem nenhuma lib de clustering — o volume de fotos de uma campanha (dezenas a poucas centenas) não justifica. O algoritmo é guloso: cada foto entra no primeiro cluster cujo centroide está a ≤150m, senão vira um cluster novo; o centroide é recalculado como média incremental a cada foto adicionada. Fotos sem GPS caem todas juntas em `NO_LOCATION_CLUSTER_ID`, ordenadas só por EXIF/data de upload.

**Tamanho de carrossel: menor teto entre as redes selecionadas, não um valor fixo do sistema**

`maxCarouselSizeForPlatforms` devolve o menor teto entre Instagram/Facebook (10, mesmo `MAX_GENERATION_ARTIFACTS` já usado na geração manual) e LinkedIn (20). O tamanho efetivo de cada carrossel é `min(carouselSizeDefault do usuário, esse teto)` — decisão explícita do usuário durante a especificação: ele prefere ser avisado e escolher manualmente quando o padrão da campanha (ex: 5, testado com "50 fotos do museu vira carrossel de 5") ultrapassar o teto de alguma rede, em vez do sistema truncar silenciosamente. Nesta fase o clamp é automático (`Math.min`); o aviso explícito ao usuário quando ele tenta um valor maior que o teto fica para quando a tela de revisão ganhar edição de agrupamento por item.

**Pacing entre localidades: round-robin entre clusters, não a ordem cronológica bruta**

`interleaveGroups` intercala os grupos de carrossel de clusters diferentes em vez de esgotar um cluster inteiro antes de passar pro próximo — evita empilhar a mesma localidade em posts consecutivos, mesmo que a ordem cronológica das fotos sugerisse isso (decisão explícita do usuário).

**Horários: espaçados uniformemente entre 9h e 21h, sem geração de IA**

`computeScheduledTimes` distribui `postsPerDay` horários por dia entre 9h e 21h (1x/dia cai às 9h) — sem inteligência adicional (não lê `AudienceSignal` nem sugere melhor horário nesta fase, ao contrário do que a feature de Insights já faz para posts manuais). O usuário revisa o horário de cada item antes de ativar.

**`GenerateCampaignTimelineUseCase` só considera a última pauta de `startDate`, sem retomar de onde parou**

Chamar `/campaigns/:id/timeline/generate` de novo depois de subir mais fotos apaga a linha do tempo anterior (`deleteByCampaign` + `saveAll`) e recalcula do zero a partir de `startDate` (default: agora). Isso é aceitável porque a tela de revisão é o portão antes de qualquer publicação real — nada foi materializado ainda nesse ponto (campanha ainda em `status: 'reviewing'`, não `'active'`).

**Ativação é idempotente por item, não por campanha inteira**

`ActivateCampaignUseCase` pula itens já `status: 'materialized'` (têm `postId`) em vez de assumir que a campanha inteira materializa de uma vez só — mesmo padrão defensivo de `AutonomyTickUseCase` (isolamento por unidade, não all-or-nothing), preparando terreno pra uma fase futura de retomar campanha pausada sem duplicar `Post`s já criados.

**Upload em lote aceita arrastar-e-soltar, e isola falha por foto (2026-07-10)** — usuário testou o upload de um lote de 29 fotos: no meio do lote, uma falha (ex: rede instável, foto grande) travava o loop de upload da tela inteiro e a lista nunca era atualizada — nenhuma foto aparecia, mesmo as que já tinham subido e sido salvas no Firestore com sucesso, porque `queryClient.invalidateQueries` só rodava depois de todas as chamadas terminarem sem erro nenhum. `handleFiles` (`apps/web/src/app/dashboard/campaigns/[id]/upload/page.tsx`) agora isola cada foto num try/catch (mesmo padrão de `AutonomyTickUseCase`/`GetPostsPerformanceUseCase` — uma falha não pode esconder o sucesso das demais) e sempre invalida a query no final, com sucesso total, parcial ou falha total; a mensagem de erro lista até 3 arquivos que falharam com o motivo de cada um, e o resto contado ("e mais N"). Aproveitando a mesma tela, a área de upload ganhou suporte a arrastar-e-soltar (`onDragOver`/`onDrop` no mesmo `<label>` que já envolvia o `<input type="file">`) — primeira dropzone do produto; antes só existia clique-para-escolher em todo o app.

**Miniaturas das fotos já enviadas na própria tela de upload (2026-07-10)** — usuário reportou não conseguir confirmar visualmente que as fotos tinham subido: a tela só mostrava um texto ("N fotos enviadas"), fácil de não notar num lote grande. `UploadedPhotoThumbnail` (mesmo padrão de `ItemThumbnail`/`PostThumbnail` já usados na tela de linha do tempo e em posts agendados — `useQuery` + `api.getImageUrl` pra resolver a URL assinada) agora mostra uma grade de miniaturas de todas as fotos já persistidas para a campanha, logo abaixo da dropzone.

## What this does not solve

Pausar/retomar campanha em andamento — ativar hoje é definitivo, sem botão de pausa (`PhotoCampaign.status` não tem um estado `'paused'`). Detecção de fotos duplicadas/quase-iguais (hash perceptual) — nenhuma foto é sinalizada nesta fase, mesmo que sejam idênticas. Legenda automática via IA — o texto inicial é um template simples (`nome/descrição + hashtags das palavras-chave`), sem chamar Gemini. Notificação por e-mail — bloqueado até confirmação de credencial de um provedor (Resend ou outro); hoje o produto não envia e-mail algum, então isso não é só configurar um lembrete, é a primeira peça de infraestrutura de notificação. Edição de agrupamento de carrossel por item na tela de revisão — hoje só a legenda é editável ali; trocar quais fotos formam qual item exige editar via API diretamente.

## References

- [_local-adr-policy-041-campanha-de-fotos-espinha-dorsal-fase-1](../../adrs/application/041-campanha-de-fotos-espinha-dorsal.md) - Decisão estrutural que esta fatia implementa
- [_local-edr-policy-038-tick-diario-de-autonomia-implementacao](038-tick-autonomia-implementacao.md) - Mesmo padrão de isolamento de falha por unidade e reaproveitamento de índice/pipeline existente
