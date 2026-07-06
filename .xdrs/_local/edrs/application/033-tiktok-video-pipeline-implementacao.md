---
name: _local-edr-policy-033-pipeline-de-video-tiktok-implementacao
description: Define a implementação do job assíncrono de renderização de vídeo, o VideoComposerPort, e a estratégia de teste do pipeline. Use ao implementar ou estender o worker de vídeo em apps/generator, ou ao escrever testes para TikTokPublisher/VideoComposerPort.
apply-to: apps/generator — VideoComposerPort, worker de renderização; apps/publisher — TikTokPublisher
valid-from: 2026-07-06
---

# _local-edr-policy-033: Pipeline de Vídeo TikTok — Implementação

## Context and Problem Statement

[_local-adr-policy-036-geracao-de-video-assincrona](../../adrs/application/036-geracao-video-multiartefato-assincrona.md) decide que vídeo roda em job assíncrono via fila. Falta definir, no nível de implementação: como o worker consome o job, como o progresso é exposto por estágio, e como o pipeline é testado dado o rate limit de 6 req/min do TikTok e o histórico de falha já observado em geração síncrona de imagem.

## Decision Outcome

**Worker consome job de Cloud Tasks, expõe progresso via `outputs.videoStage`, e o `TikTokPublisher` é testado contra um mock da API, nunca contra o serviço real.**

### Details

**Estágios de progresso**

`GenerationArtifact` de `mediaType: 'video'` ganha `videoStage: 'rendering-images' | 'composing-video' | 'mixing-audio' | 'publishing' | null`, atualizado a cada transição via `updateOutputs()` — mesmo mecanismo de persistência incremental de EDR-029, permitindo que o cliente exiba estágio real durante o polling em vez de um spinner genérico (requisito de CHRONOS na deliberação de origem).

**VideoComposerPort**

```typescript
interface VideoComposerPort {
  compose(input: {
    slides: { imagePath: string, durationSeconds: number }[] | null
    userVideoPath: string | null
    audio: { mode: 'narration' | 'music' | 'silence', narrationText?: string, musicStyle?: string } | null
  }): Promise<{ videoPath: string, durationSeconds: number }>
}
```

Implementado via ffmpeg no `generator-service` — escolha consistente com o restante do container (já processa mídia via `sharp`/`vips`), evitando dependência de navegador headless.

**Cobertura de teste — fronteiras físicas antes de combinações exaustivas**

Seguindo a priorização de PARETO na deliberação de origem: testes concentram-se nos limites documentados da API do TikTok (duração 3s e 600s, tamanho próximo de 4GB) e no ponto de falha já observado historicamente (timeout de renderização) — não em cobertura uniforme das seis combinações de origem×áudio.

**Mock da API TikTok**

`TikTokPublisher` é testado contra um cliente HTTP mockado (Page Object/Screenplay Pattern, seguindo [_local-edr-policy-001-tdd-obrigatoria](../principles/001-tdd.md)) que simula os estados de `publish_id` (`PROCESSING`, `PUBLISH_COMPLETE`, falha). Nenhum teste automatizado chama a API real do TikTok — o rate limit de 6 req/min torna isso inviável para execução repetida em CI.

**Sincronização de teste sem sleep**

Testes que esperam o job de vídeo concluir fazem polling sobre `videoStage`/`status`, nunca `sleep` fixo — mesmo princípio de anti-flakiness já aplicado a qualquer teste assíncrono no projeto.

**Sessão exploratória obrigatória antes do lançamento**

Charter dedicado ao cenário "vídeo renderiza com sucesso, API do TikTok falha durante a etapa de publicação" — não coberto por nenhuma especificação existente, identificado como lacuna na deliberação de origem (PROBE).

## References

- [_local-adr-policy-036-geracao-de-video-assincrona](../../adrs/application/036-geracao-video-multiartefato-assincrona.md) - Decisão arquitetural que este EDR implementa
- [_local-adr-policy-035-tiktok-publicacao-multi-etapa](../../adrs/integration/035-tiktok-publicacao-multi-chunk.md) - Fluxo de publicação implementado por TikTokPublisher
- [_local-edr-policy-029-geracao-multiartefato-sem-bifurcacao](029-pipeline-geracao-multiartefato.md) - Precedente de persistência incremental por artefato
- [_local-edr-policy-001-tdd-obrigatoria](../principles/001-tdd.md) - TDD aplicado ao VideoComposerPort e ao mock de TikTokPublisher
