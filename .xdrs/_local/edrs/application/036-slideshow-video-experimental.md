---
name: _local-edr-policy-036-slideshow-animado-experimental
description: Define a primeira fatia testável de vídeo gerado por IA (slideshow animado a partir de imagens já geradas, sem áudio, síncrono) — uma ação avulsa e experimental fora do fluxo normal de geração/publicação, deliberadamente divergente do modelo assíncrono de _local-adr-policy-036. Use ao evoluir esta fatia para o pipeline completo, ou ao entender por que este composer roda síncrono onde a arquitetura original pedia fila.
apply-to: apps/generator — FfmpegVideoComposer, POST /videos/compose-slideshow; apps/api — POST /videos/compose-slideshow, GET /videos/signed-url; apps/web — botão experimental em /dashboard/generate
valid-from: 2026-07-09
---

# _local-edr-policy-036: Slideshow Animado Experimental

## Context and Problem Statement

`_local-adr-policy-036` decide que geração de vídeo deve rodar assíncrona via fila, e `_local-edr-policy-033` desenha o worker completo (Cloud Tasks, `videoStage`, `VideoComposerPort` via ffmpeg). Esse desenho completo ainda não foi implementado — depende de infraestrutura nova (fila) e de decisões (áudio, catálogo de música) que ainda não foram testadas na prática.

Antes de investir nessa fila completa, era preciso responder uma pergunta mais simples e mais barata de errar: **o ffmpeg consegue mesmo transformar as imagens já geradas em um vídeo válido?** Sem essa resposta, construir a fila assíncrona, o rastreamento de `videoStage` e a integração com publicação seria investimento em cima de uma peça (o composer) nunca validada.

## Decision Outcome

**Endpoint síncrono, avulso e opt-in — não integrado ao fluxo de geração (`POST /generate`) nem ao de publicação — que compõe um slideshow a partir de imagens já prontas, sem áudio, e devolve o vídeo para pré-visualização. Testado ao vivo com o usuário presente, não deployado às cegas.**

### Details

**Por que síncrono aqui, mesmo com `_local-adr-policy-036` exigindo assíncrono**

A arquitetura assíncrona da ADR-036 protege o `POST /generate` original de carregar o peso da renderização de vídeo. Este endpoint é uma ação **separada e opt-in** — um clique explícito em "Gerar vídeo de teste" na tela de resultado, depois que as imagens já existem — não faz parte do `POST /generate`. Como é uma chamada isolada, com seu próprio estado de carregamento na UI, e como o objetivo desta fatia é validar se o composer funciona (não entregar a experiência final), rodar síncrono foi a forma mais rápida de obter uma resposta testável. Se o tempo de renderização se mostrar um problema real no uso, a fila entra depois — decisão adiada até haver dado real, não presumida de antemão.

**Escopo desta fatia**

- Apenas modo `slideshow` a partir de imagens já geradas (não cobre `videoSource: 'user-upload'`, que já existe desde `_local-edr-policy-035`).
- Sem áudio — nem narração nem música, apenas o modo silêncio de `_local-adr-policy-037` (uma trilha de áudio silenciosa é adicionada via ffmpeg só para garantir compatibilidade de container, não é "silêncio" no sentido de ausência de faixa).
- Sem persistência: `GenerationArtifact` não ganhou `mediaType`/`videoStage`/`videoStoragePath` nesta fatia — o vídeo composto não fica associado ao `GenerationRequest` no Firestore, só é devolvido na resposta HTTP para pré-visualização imediata.
- Sem integração com publicação: o vídeo gerado aqui **não é usado automaticamente para publicar no TikTok** — isso é decisão de fatia futura, depois de confirmado que o resultado é aceitável.
- Máximo de 10 imagens por composição (mesmo teto de `_local-adr-policy-028-geracao-multiartefato`'s `MAX_GENERATION_ARTIFACTS`), 3 segundos por slide, formato vertical 1080×1920 fixo (não segue o `AspectRatio` do post — o vídeo é sempre otimizado para TikTok, independente do formato de imagem escolhido).

**Composição via ffmpeg — Ken Burns por segmento + concat**

`FfmpegVideoComposer` gera um segmento de vídeo por imagem via `zoompan` (zoom lento e contínuo), depois concatena os segmentos via o demuxer `concat` do ffmpeg — padrão amplamente documentado, escolhido por ser mais previsível que uma única cadeia `filter_complex` com múltiplas entradas. Cada segmento usa os mesmos parâmetros de codec (`libx264`, `yuv420p`, 25fps) para garantir compatibilidade do `concat -c copy`.

**Risco assumido conscientemente: sem verificação de execução real do ffmpeg antes do primeiro teste**

O ambiente onde este código foi escrito não tem ffmpeg nem Docker disponíveis para validar a composição antes do deploy — os testes automatizados mockam a chamada ao binário (`node:child_process`), validando a orquestração (arquivos temporários, ordem das chamadas, limpeza) mas não a saída real do ffmpeg. A sintaxe do filtro `zoompan` segue o padrão mais comumente documentado para este efeito, mas a primeira confirmação real de que produz um vídeo válido só acontece no teste ao vivo em produção, com o usuário presente — mesmo modelo de validação que fechou o EDR-035 original (três rodadas de erro real → correção, até a primeira publicação confirmada).

## What this does not solve

Fila assíncrona com `videoStage` (desenho completo de `_local-edr-policy-033`), áudio (narração TTS ou música de `_local-adr-policy-037`), integração com o fluxo de publicação (o vídeo ainda não vira `Post.videoStoragePath` automaticamente), persistência do vídeo como artefato do `GenerationRequest`, e suporte a `videoSource: 'user-upload'` combinado com composição por IA. Nenhum desses existe ainda — esta decisão cobre apenas a validação mínima de que a composição funciona.

## References

- [_local-adr-policy-036-geracao-video-multiartefato-assincrona](../../adrs/application/036-geracao-video-multiartefato-assincrona.md) - Decisão arquitetural da qual este EDR diverge deliberadamente (síncrono em vez de fila) para esta fatia de validação
- [_local-edr-policy-033-pipeline-de-video-tiktok-implementacao](033-tiktok-video-pipeline-implementacao.md) - Desenho completo (fila, videoStage) que esta fatia não implementa ainda
- [_local-edr-policy-035-upload-de-video-para-tiktok-mvp-sincrono](035-upload-video-tiktok-mvp-sincrono.md) - Precedente de escopo reduzido testável antes do pipeline completo, e do modelo de validação por teste ao vivo
- [_local-adr-policy-037-audio-sincronizacao-biblioteca-musica](../../adrs/application/037-audio-sincronizacao-biblioteca-musica.md) - Modo silêncio usado aqui; narração e música ficam para fatia futura
