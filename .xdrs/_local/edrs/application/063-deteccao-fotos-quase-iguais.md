---
name: _local-edr-policy-063-deteccao-de-fotos-quase-iguais
description: Hash perceptual (dHash) calculado no upload da foto de campanha; fotos com distância de Hamming baixa são colapsadas na geração da linha do tempo, mantendo só um representante por carrossel e listando as demais como "extras" visíveis na revisão. Use ao mexer em upload de foto de campanha, clustering ou na tela de revisão.
apply-to: apps/generator — computePerceptualHash, rota /images/upload; apps/api — nearDuplicates, duplicateMarks, GenerateCampaignTimelineUseCase, ExtendCampaignTimelineUseCase; apps/web — tela de revisão da campanha
valid-from: 2026-07-22
---

# _local-edr-policy-063: Detecção de Fotos Quase-Iguais

## Context and Problem Statement

`_local-adr-policy-041` e `_local-edr-policy-048` deixaram registrado, deliberadamente, que detecção de fotos duplicadas/quase-iguais ficaria para uma fase futura. Usuário relatou carrosséis com várias fotos praticamente idênticas (ex: sequência de disparos do mesmo pôr do sol) lado a lado no mesmo post. Como agrupar ou excluir fotos muito parecidas de um carrossel automaticamente, sem descartar nenhuma foto do usuário em silêncio?

## Decision Outcome

**dHash de 64 bits calculado no upload; fotos com distância de Hamming ≤ 8 dentro do mesmo cluster de local/momento são colapsadas — só o representante entra no carrossel, as demais viram "extras" marcadas e visíveis na tela de revisão.**

### Details

**Hash perceptual, não comparação de bytes ou de conteúdo via IA**

`computePerceptualHash` (`apps/generator/src/lib/perceptualHash.ts`, `sharp`) reduz a imagem a 9x8 tons de cinza e compara cada pixel com o vizinho à direita, gerando 64 bits determinísticos e baratos — sem IA, sem depender de rede. Calculado só no upload de foto de campanha (flag opcional `perceptualHash` em `POST /images/upload`, default `false` — o upload manual de geração não paga esse custo). Fotos sem hash (enviadas antes desta feature, ou formato que o `sharp` não decodifica) nunca são tratadas como duplicata.

**Colapso dentro do cluster de localização, não na lista inteira**

`collapseNearDuplicates` (`apps/api/src/use-cases/campaigns/nearDuplicates.ts`) roda por cluster de GPS/momento (`clusterByLocation`), não sobre todas as fotos da campanha — duas fotos parecidas tiradas em lugares/dias diferentes não colapsam entre si. Dentro de um cluster, a primeira foto de cada grupo vira representante; as seguintes a até `NEAR_DUPLICATE_THRESHOLD` (8) bits de distância do representante viram extras. Threshold ajustável nessa constante conforme feedback real de uso.

**Nunca descartar — pool de extras na revisão**

`duplicateOfPhotoId` em `CampaignPhoto` aponta pro id do representante quando a foto foi colapsada; `null` para representantes e fotos sem duplicata. A tela de revisão (`/dashboard/campaigns/[id]/timeline`) mostra um pool "fotos quase iguais deixadas de fora", agrupado sob a foto mantida, com aviso explícito de que nada foi apagado (`_local-adr-policy-006`, dados como passivo — mas nunca ao custo de apagar dado do usuário sem ele pedir).

**Regeneração remarca do zero; extensão marca só as fotos novas**

`GenerateCampaignTimelineUseCase` reseta `duplicateOfPhotoId` de todas as fotos a cada regeneração. `ExtendCampaignTimelineUseCase` só recalcula entre as fotos recém-adicionadas — fotos já materializadas em `Post` real nunca são retroativamente marcadas como duplicata.

## What this does not solve

Fotos já enviadas antes desta feature não têm hash — não são candidatas a colapso até serem reenviadas. Sem ação de "readicionar" uma extra de volta ao carrossel a partir da tela de revisão (hoje é só visualização).

## References

- [_local-adr-policy-041-campanha-de-fotos-espinha-dorsal-fase-1](../../adrs/application/041-campanha-de-fotos-espinha-dorsal.md) - Deferiu esta detecção para fase futura
- [_local-edr-policy-048-legenda-de-campanha-por-ia](048-legenda-de-campanha-por-ia.md) - Mesma lista de pendências, mesma campanha de trabalho
