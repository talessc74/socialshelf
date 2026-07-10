---
name: _local-edr-policy-037-publicar-em-mais-redes-apos-o-video
description: Generaliza o gatilho de "Publicar também em" na tela de resultado da geração — antes só aparecia depois do post principal (texto/imagem) ser publicado, agora também aparece depois de publicar o vídeo do TikTok. Use ao entender por que a seção de redes extras não fica mais aninhada dentro do bloco condicional de publishResult, ou ao decidir se um post existente deve ganhar mais plataformas por extensão em vez de um novo Post.
apply-to: apps/web — ResultView em /dashboard/generate
valid-from: 2026-07-10
---

# _local-edr-policy-037: Publicar em Mais Redes Após o Vídeo

## Context and Problem Statement

A tela de resultado de `/dashboard/generate` já tinha uma seção "Publicar também em:" que aparece depois de um post ser publicado, para reaproveitar a copy já gerada em plataformas conectadas que não foram usadas na geração original. Essa seção só era renderizada dentro do ramo condicional de `publishResult` — o resultado do botão "Publicar Agora" (post de texto/imagem, sem TikTok, que nunca tem etapa de upload de vídeo).

Só que a ação "Publicar no TikTok com este vídeo" (fluxo experimental de `_local-edr-policy-036`) é uma publicação completamente separada, com seu próprio estado (`tiktokVideoPublishResult`), fora desse ramo. Quem publicava o vídeo no TikTok sem nunca clicar em "Publicar Agora" nunca via a opção de publicar em mais redes — mesmo tendo, na prática, um post pronto o bastante para valer a pena espalhar.

## Decision Outcome

**A seção "Publicar também em:" saiu de dentro do bloco condicional de `publishResult` e virou um bloco independente, renderizado sempre que `publishResult` OU `tiktokVideoPublishResult` existir.**

### Details

O bloco de resultados (✓/✗ por plataforma) do post principal continua exatamente como estava, só respondendo a `publishResult` — nenhuma mudança de comportamento aí. `extraResults`/`extraFailed` (acumulados pelas rodadas de "Publicar também em") saíram desse bloco e foram para o novo bloco independente, já que antes só apareciam quando `publishResult` existia mesmo que a extra-publicação tivesse vindo de outra origem.

**Post novo, não extensão do post existente** — mantido o padrão já usado por `handlePublishMore`: cada rodada de "publicar em mais redes" cria um `Post` novo com só as plataformas recém-selecionadas, em vez de estender `content[]` do post original e re-publicar. Isso vale tanto para quando a origem foi o post de texto quanto para quando foi o vídeo do TikTok. Motivo (documentado no código-fonte, repetido aqui porque é a decisão que mais importa entender antes de mudar isso): `PublishPostUseCase.execute` itera `post.content` inteiro sem checar se `externalIds[platform]` já foi preenchido — reusar/republicar o mesmo `Post` reprocessaria plataformas já publicadas com sucesso. Resolver isso do lado do publisher (guard de "já publicado, pula") é pré-requisito para qualquer futura tentativa de estender o post original em vez de criar um novo.

TikTok continua fora de `availableExtraPlatforms` sempre — esse atalho nunca teve etapa de upload de vídeo, e antes de qualquer coisa, se o vídeo já foi publicado nesta mesma tela, adicionar TikTok de novo não faz sentido de qualquer forma.

## What this does not solve

Extensão do post original com plataformas adicionais (continua sempre criando um novo `Post`) — ver justificativa acima sobre o guard que falta em `PublishPostUseCase`. Nenhuma mudança em `/dashboard/compose`, que nunca teve esta seção. Nenhuma mudança na regra de que TikTok exige vídeo.

## References

- [_local-edr-policy-036-slideshow-animado-experimental](036-slideshow-video-experimental.md) - Fluxo de publicação do vídeo do TikTok cujo resultado agora também aciona esta seção
