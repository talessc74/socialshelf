---
name: _local-edr-policy-036-slideshow-animado-experimental
description: Define a primeira fatia testável de vídeo gerado por IA (slideshow animado a partir de imagens já geradas, com narração por IA opcional, síncrono), confirmada em teste real e já ligada à publicação no TikTok — uma ação avulsa fora do fluxo normal de geração, deliberadamente divergente do modelo assíncrono de _local-adr-policy-036. Use ao evoluir esta fatia para o pipeline completo, ao adicionar música, ou ao entender por que este composer roda síncrono onde a arquitetura original pedia fila.
apply-to: apps/generator — FfmpegVideoComposer, GoogleTextToSpeechSynthesizer, POST /videos/compose-slideshow; apps/api — POST /videos/compose-slideshow, GET /videos/signed-url; apps/web — botão experimental em /dashboard/generate
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
- Narração por IA implementada (ver seção própria abaixo); música de biblioteca continua fora — trava real de licenciamento, não de engenharia.
- Sem persistência: `GenerationArtifact` não ganhou `mediaType`/`videoStage`/`videoStoragePath` nesta fatia — o vídeo composto não fica associado ao `GenerationRequest` no Firestore, só é devolvido na resposta HTTP para pré-visualização imediata.
- Máximo de 10 imagens por composição (mesmo teto de `_local-adr-policy-028-geracao-multiartefato`'s `MAX_GENERATION_ARTIFACTS`), 3 segundos por slide, formato vertical 1080×1920 fixo (não segue o `AspectRatio` do post — o vídeo é sempre otimizado para TikTok, independente do formato de imagem escolhido).

**Composição via ffmpeg — Ken Burns por segmento + concat**

`FfmpegVideoComposer` gera um segmento de vídeo por imagem via `zoompan` (zoom lento e contínuo), depois concatena os segmentos via o demuxer `concat` do ffmpeg — padrão amplamente documentado, escolhido por ser mais previsível que uma única cadeia `filter_complex` com múltiplas entradas. Cada segmento usa os mesmos parâmetros de codec (`libx264`, `yuv420p`, 25fps) para garantir compatibilidade do `concat -c copy`.

**Risco assumido conscientemente: sem verificação de execução real do ffmpeg antes do primeiro teste**

O ambiente onde este código foi escrito não tem ffmpeg nem Docker disponíveis para validar a composição antes do deploy — os testes automatizados mockam a chamada ao binário (`node:child_process`), validando a orquestração (arquivos temporários, ordem das chamadas, limpeza) mas não a saída real do ffmpeg. A sintaxe do filtro `zoompan` segue o padrão mais comumente documentado para este efeito, mas a primeira confirmação real de que produz um vídeo válido só acontece no teste ao vivo em produção, com o usuário presente — mesmo modelo de validação que fechou o EDR-035 original (três rodadas de erro real → correção, até a primeira publicação confirmada).

**Confirmado em teste real (2026-07-09)** — composição validada ao vivo pelo usuário: ffmpeg produziu um vídeo válido a partir das imagens geradas.

**Integração com publicação — fechada na mesma sessão**

Depois da composição confirmada, um botão dedicado ("Publicar no TikTok com este vídeo") foi adicionado na mesma seção experimental: cria um `Post` com `videoStoragePath` apontando para o vídeo composto e `videoConsentAcceptedAt: null` (o checkbox de `_local-edr-policy-034` é sobre vídeo enviado pelo usuário contendo terceiros — aqui o conteúdo é gerado pela IA a partir de imagens já geradas pelo próprio pipeline, mesma categoria de conteúdo original já isenta desse consentimento), e publica imediatamente via o fluxo já existente (`TikTokPublisher`). Exige que TikTok tenha sido selecionado como plataforma na geração (para existir uma legenda pronta) — sem isso, o botão de publicar não aparece, só o de gerar/testar o vídeo.

**Ajuste de performance após uso real (2026-07-09)** — uma composição com mais imagens produziu "Load failed" no celular do usuário. Causa: o pré-scale do `zoompan` estava em 8000px de largura por imagem (bem mais que o necessário para evitar pixelização no zoom), pesado o bastante no único vCPU do `generator-service` para a requisição síncrona ultrapassar o que uma conexão móvel mais fraca tolera. Reduzido para 2x a largura final (2160px) e adicionado `-preset veryfast` no encode. Testado novamente ao vivo pelo usuário após o ajuste: publicação confirmada com sucesso.

**Narração por IA (2026-07-09) — modo narração de `_local-adr-policy-037`**

`TextToSpeechPort` (novo) + `GoogleTextToSpeechSynthesizer`, via `@google-cloud/text-to-speech` (`languageCode: 'pt-BR'`, sem nome de voz fixo — deixa o Google escolher uma voz compatível, evitando depender de um nome exato que pode não existir em toda conta/região). Texto narrado é a legenda de TikTok já gerada pela IA (checkbox "Narrar com voz de IA" no `/dashboard/generate`, só habilitado quando essa legenda existe) — nunca um campo de texto livre novo, conforme a ADR.

Simplificação consciente em relação ao texto da ADR-037 ("tempo de cada slide distribuído proporcionalmente entre as posições"): esta fatia sintetiza a narração **uma única vez** para o texto inteiro, mede a duração via `ffprobe`, e divide igualmente entre as imagens (`duração_total / N_imagens`), em vez de segmentar o texto por posição e sintetizar cada trecho separado. Distribuição igual e distribuição "proporcional" coincidem quando não há nenhum outro sinal de peso por posição — mas segmentar por posição (ligando cada trecho de texto à imagem correspondente) é uma evolução real, não implementada aqui. Piso de 1.5s por slide evita durações degenerate quando há poucas palavras e muitas imagens.

Infra: `texttospeech.googleapis.com` habilitada no bootstrap do deploy (mesmo padrão do `cloudscheduler.googleapis.com`). Diferente de outras APIs do Google já usadas no projeto (Vertex AI, Cloud Storage), não há um role de IAM dedicado e documentado para Text-to-Speech — a suposição de que "API habilitada + credenciais do generator-service já bastam" não foi confirmada em produção no momento em que este texto foi escrito; se faltar permissão, o erro real na primeira chamada dirá exatamente o que falta.

**Teto de duração por slide após narração reabrir o mesmo gargalo (2026-07-09)** — "Load failed" ocorreu de novo em teste real, desta vez com narração ligada e sinal 5G forte (afastando causa de rede fraca). Causa: `slideDurationSeconds = narrationDuration / N_imagens` tinha piso (`MIN_SLIDE_DURATION_SECONDS`) mas nenhum teto — uma legenda longa narrada com poucas imagens produz slides muito longos, e cada segundo a mais de slide é um segundo a mais de `zoompan` para codificar por imagem. Mesma classe de problema do ajuste de performance acima (composição lenta demais para uma requisição síncrona), reaberta por um vetor diferente (duração em vez de resolução de pré-scale). Adicionado `MAX_SLIDE_DURATION_SECONDS = 8`: acima do teto, a narração é cortada no final pelo `-shortest` do mux — o vídeo fica mais curto que a narração completa, risco aceito em troca de tempo de composição prevísivel. Ainda não reconfirmado em teste ao vivo pelo usuário no momento em que este texto foi escrito.

**Persistência do vídeo composto + download (2026-07-10)**

O vídeo composto agora sobrevive a um reload da tela de resultado: `outputs.composedVideo` (novo campo em `GenerationRequest`, fora de `GenerationArtifact[]` porque é um único vídeo por geração, não um artefato por posição) guarda `{ storagePath, durationSeconds, narrated }`. `POST /videos/compose-slideshow` persiste esse campo depois do upload no GCS, best-effort — se a escrita no Firestore falhar, a resposta HTTP ainda devolve o vídeo normalmente (o vídeo já foi composto e enviado com sucesso; a persistência é conveniência, não pré-condição). `ResultView` inicializa `composedVideoPath` a partir desse campo em vez de sempre começar vazio.

Isso ainda não é o artefato completo pedido pela ADR-036 (sem `videoStage`, sem fila) — é só o mínimo para o vídeo não se perder entre visitas à tela, fechando parcialmente a lacuna registrada abaixo. A retenção de 7 dias (`_local-edr-policy-034`) continua valendo: o path persistido pode apontar para um arquivo já apagado do GCS depois desse prazo, mesmo que a referência no Firestore continue existindo — nenhuma limpeza do lado do Firestore foi adicionada para isso.

Botão "Baixar vídeo" reaproveita o mesmo `GET /videos/signed-url`, agora aceitando `?download=true` — repassado até `GcsVideoStorage.getSignedUrl` como `promptSaveAs`, que define `Content-Disposition: attachment` na resposta do GCS. Escolhido em vez do atributo `download` do `<a>` porque esse atributo é ignorado pelo navegador quando a URL é de outra origem (a signed URL é `storage.googleapis.com`, não o domínio do site) — o `Content-Disposition` do lado do servidor força o download independente disso.

## What this does not solve

Fila assíncrona com `videoStage` (desenho completo de `_local-edr-policy-033`), música de biblioteca (bloqueada por falta de faixas licenciadas reais, não por engenharia), narração segmentada por posição/slide (hoje é um único áudio dividido em partes iguais, não sincronizado por conteúdo), e suporte a `videoSource: 'user-upload'` combinado com composição por IA. Nenhum desses existe ainda.

## References

- [_local-adr-policy-036-geracao-video-multiartefato-assincrona](../../adrs/application/036-geracao-video-multiartefato-assincrona.md) - Decisão arquitetural da qual este EDR diverge deliberadamente (síncrono em vez de fila) para esta fatia de validação
- [_local-edr-policy-033-pipeline-de-video-tiktok-implementacao](033-tiktok-video-pipeline-implementacao.md) - Desenho completo (fila, videoStage) que esta fatia não implementa ainda
- [_local-edr-policy-035-upload-de-video-para-tiktok-mvp-sincrono](035-upload-video-tiktok-mvp-sincrono.md) - Precedente de escopo reduzido testável antes do pipeline completo, e do modelo de validação por teste ao vivo
- [_local-adr-policy-037-audio-sincronizacao-biblioteca-musica](../../adrs/application/037-audio-sincronizacao-biblioteca-musica.md) - Modo silêncio usado aqui; narração e música ficam para fatia futura
