---
name: _local-adr-policy-036-geracao-de-video-assincrona
description: Define como GenerationRequest passa a produzir artefatos de vídeo além de imagem, e por que a geração de vídeo roda em modelo assíncrono com fila em vez do modelo síncrono request/response usado por imagem. Use ao implementar VideoComposerPort, o job de renderização de vídeo, ou ao estender GenerateContentUseCase para TikTok.
apply-to: packages/domain — GenerationRequest, GenerationArtifact, VideoComposerPort; apps/generator — geração de vídeo
valid-from: 2026-07-06
---

# _local-adr-policy-036: Geração de Vídeo Assíncrona

## Context and Problem Statement

[_local-adr-policy-028-geracao-de-conteudo-multiartefato](028-geracao-multiartefato.md) modela `GenerationRequest.outputs.artifacts: GenerationArtifact[]` como imagens — post único ou carrossel, sempre imagem. A integração com TikTok exige que a mesma criação produza também um **vídeo**: slideshow das imagens já geradas (com movimento) ou vídeo próprio enviado pelo usuário, com trilha de áudio opcional.

O pipeline de imagem já roda síncrono dentro do request/response HTTP, e esse modelo já se mostrou no limite: o timeout do `generator` cresceu de 120s para 300s em produção só para acomodar geração de imagem via Vertex AI ([_local-edr-policy-007-cloud-run-deployment](../../edrs/infra/007-cloud-run.md)). Renderização de vídeo (composição de múltiplas imagens com movimento, mixagem de áudio, encoding) é ordens de grandeza mais pesada que gerar uma imagem via Imagen.

Como estender `GenerationRequest` para produzir vídeo sem herdar a fragilidade já observada no modelo síncrono?

## Decision Outcome

**`GenerationArtifact` ganha `mediaType: 'image' | 'video'`. Artefatos de imagem continuam síncronos (comportamento inalterado de ADR-028/029). Artefatos de vídeo rodam em job assíncrono com fila, fora do request/response do `POST /generate`.**

### Details

**Por que vídeo não pode ser síncrono**

O timeout de 300s do `generator` já é o resultado de um incidente real de produção causado por geração de imagem. Vídeo envolve renderização de N imagens com movimento (Ken Burns ou similar), mixagem de áudio (narração ou música com fade-out) e encoding para o formato exigido pelo TikTok — tempo de processamento não cabe com margem segura dentro de uma única requisição HTTP, mesmo no limite já esticado duas vezes. Tratar vídeo como síncrono repete o mesmo padrão de falha já visto, com escopo pior.

**Modelo assíncrono**

```typescript
interface GenerationArtifact {
  position: number
  mediaType: 'image' | 'video'
  status: ArtifactStatus  // 'pending' | 'generating' | 'ready' | 'failed'
  storagePath: string | null
  error: string | null
}
```

Um job de renderização de vídeo é enfileirado (Cloud Tasks, seguindo o padrão de acionamento assíncrono já usado por [_local-adr-policy-033-cloud-scheduler-publicacao-agendada](../platform/033-cloud-scheduler-scale-to-zero.md)) em vez de executado inline. O artefato de vídeo permanece em `generating` até o job concluir, atualizando `GenerationRequestRepository.updateOutputs()` — mesmo mecanismo de persistência incremental já usado por imagem (EDR-029), sem necessidade de nova sub-coleção.

O cliente continua fazendo polling em `GET /generation-requests/{id}` (ADR-019) — o padrão de observabilidade não muda; muda apenas onde e como o artefato é processado internamente.

**Uma criação, dois tipos de mídia**

Quando TikTok está entre as plataformas selecionadas, a mesma `GenerationRequest` produz o array de imagens (para LinkedIn/X/Instagram/Facebook, comportamento inalterado) e um artefato de vídeo adicional (para TikTok). `GenerateContentUseCase` não bifurca lógica por plataforma — gera os artefatos de imagem como já faz, e enfileira o job de vídeo se `platforms.includes('tiktok')`, seguindo o mesmo espírito de "sem bifurcação" já estabelecido por [_local-edr-policy-029-geracao-multiartefato-sem-bifurcacao](../../edrs/application/029-pipeline-geracao-multiartefato.md).

**Isolamento do workload**

O processo que consome o job de renderização de vídeo roda como serviço interno autenticado (`--no-allow-unauthenticated`), mesma postura zero-trust de `generator`/`publisher` já estabelecida em [_local-adr-policy-005-zero-trust-baseline](../controls/005-zero-trust-baseline.md) — nenhuma exceção por ser um workload novo.

**Origem do vídeo — slideshow ou upload próprio**

`GenerateContentInput` ganha `videoSource: 'slideshow' | 'user-upload'`. Quando `slideshow`, `VideoComposerPort` compõe o vídeo a partir dos artefatos de imagem já gerados na mesma requisição. Quando `user-upload`, o vídeo enviado pelo usuário (armazenado via o mesmo mecanismo de upload genérico de ADR-031) é usado como base, com áudio aplicado por cima conforme [_local-adr-policy-037](037-audio-sincronizacao-biblioteca-musica.md).

## What this does not solve

Escolha do encoder/biblioteca de composição de vídeo (ffmpeg ou equivalente) é decisão de implementação, não arquitetural — fica para o EDR de implementação. Edição de um vídeo já renderizado (equivalente ao `EditArtifactUseCase` de imagem) não é coberta por esta decisão.

## References

- [_local-adr-policy-028-geracao-de-conteudo-multiartefato](028-geracao-multiartefato.md) - Modelo de artefatos que esta decisão estende
- [_local-adr-policy-019-geracao-de-conteudo-maquina-de-estados](019-generation-state-machine.md) - Estados de GenerationRequest reutilizados
- [_local-edr-policy-007-cloud-run-deployment](../../edrs/infra/007-cloud-run.md) - Histórico de timeout que motiva o modelo assíncrono
- [_local-adr-policy-005-zero-trust-baseline](../controls/005-zero-trust-baseline.md) - Postura de acesso do novo workload
- [_local-adr-policy-037-audio-sincronizacao-biblioteca-musica](037-audio-sincronizacao-biblioteca-musica.md) - Modelo de áudio aplicado ao vídeo produzido aqui
- [_local-bdr-policy-003-redes-sociais-suportadas](../../bdrs/product/003-redes-sociais-suportadas.md) - TikTok como quinta plataforma suportada
