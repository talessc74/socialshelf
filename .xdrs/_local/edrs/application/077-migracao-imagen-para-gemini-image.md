---
name: _local-edr-policy-077-migracao-de-imagen-para-gemini-image
description: A família de modelos "Imagen" standalone (endpoint REST :predict) foi descontinuada pelo Google e removida do Model Garden — todas as chamadas de geração de imagem passaram a falhar com 404 NOT_FOUND, derrubando silenciosamente a única tentativa diária do tick de autonomia (nenhum artifact pronto → post inteiro marcado failed) e travando a publicação automática por semanas sem nenhum deploy quebrado de código. GeminiImageGenerator substitui ImagenImageGenerator, chamando gemini-2.5-flash-image via generateContent (mesmo protocolo já usado pelas classes de texto) em vez do endpoint :predict antigo. Use ao mexer em geração de imagem, GEMINI_IMAGE_MODEL, ou ao investigar por que a publicação automática parou sem nenhuma mudança de código correspondente.
apply-to: apps/generator — infrastructure/vertexai/GeminiImageGenerator.ts, routes/generation.routes.ts; packages/domain — value-objects/AiPricing.ts (GEMINI_IMAGE_USD_PER_IMAGE, estimateGeminiImageCostUsd); .github/workflows/deploy.yml, .env.example (GEMINI_IMAGE_MODEL)
valid-from: 2026-09-09
---

# _local-edr-policy-077: Migração de Imagen para Gemini Image

## Context and Problem Statement

Usuário reportou: a publicação automática parou por completo há quase 3 semanas, em todas as
redes — sem nenhum deploy de código no período (`main` não mudava desde 04/08). O histórico do
tick de autonomia mostrava, todo dia, a mesma sequência: a única tentativa diária (1 post/dia)
falhava com `generation did not finish ready (status: failed)`, e o resto do dia ficava "Pulado
— ainda não é hora do próximo post" (a vaga do dia já tinha sido consumida pela tentativa que
falhou).

Reproduzindo manualmente em "Gerar com IA": a copy (texto) gerava normalmente, mas as 5
tentativas de imagem falhavam todas com o mesmo erro —

```
Imagen prediction failed: 404 {
  "error": {
    "code": 404,
    "message": "Publisher Model `projects/socialshelf-547da/locations/us-central1/publishers/
    google/models/imagen-4.0-generate-001` was not found or your project does not have access
    to it...",
    "status": "NOT_FOUND"
  }
}
```

Investigação no Model Garden do Google Cloud (Vertex AI) confirmou: **não existe mais nenhum
modelo chamado "Imagen" no catálogo** — nem por busca fuzzy, nem por full-text search. A Google
descontinuou a linha standalone Imagen e migrou a capacidade de geração de imagem para dentro
dos próprios modelos Gemini multimodais (apelidados "Nano Banana"): `Gemini 2.5 Flash Image`,
`Gemini 3.1 Flash Image`, `Gemini 3 Pro Image`, entre outros.

Como todos os artifacts (imagens) de um post falhavam, `GenerateContentUseCase` marcava
`status: 'failed'` ("All artifacts failed to generate") mesmo com a copy pronta — e sem post
pronto, o tick de autonomia nunca tinha o que publicar, todo santo dia, silenciosamente.

## Decision Outcome

**`GeminiImageGenerator` substitui `ImagenImageGenerator`: chama `gemini-2.5-flash-image` via
`generateContent` (mesmo protocolo/SDK `@google/genai` já usado pelas classes de texto do
projeto), em vez do endpoint REST `:predict` específico do Imagen antigo.**

### Details

**Mudança de protocolo, não só de nome de modelo**

O endpoint antigo (`https://{location}-aiplatform.googleapis.com/v1/projects/.../publishers/
google/models/{model}:predict`, com `instances`/`parameters.sampleCount`/`parameters.
aspectRatio`/`parameters.negativePrompt`) não existe para os modelos Gemini de imagem — eles
usam o mesmo `ai.models.generateContent({ model, contents, config })` que `GeminiCopyGenerator`,
`GeminiArtDirector` etc. já usam, com `config.responseModalities: ['Image']` e
`config.imageConfig.aspectRatio`. A resposta vem em `candidates[0].content.parts[].inlineData.
{data, mimeType}`, não em `predictions[0].bytesBase64Encoded`.

**`AspectRatio` do domínio já era compatível, sem mapeamento**

Os 4 valores do enum (`1:1`, `3:4`, `16:9`, `9:16`) já batem exatamente com a whitelist aceita
por `imageConfig.aspectRatio` ("1:1", "2:3", "3:2", "3:4", "4:3", "9:16", "16:9", "21:9") —
nenhuma tradução de valor foi necessária.

**Sem parâmetro de negativePrompt dedicado — vira instrução de texto no prompt**

A API de imagem do Gemini não tem um campo equivalente a `parameters.negativePrompt` do Imagen
antigo. O que antes ia como parâmetro estruturado agora entra como instrução de texto no próprio
prompt (`" Evite: ..."`), mesma técnica que `noTextSection` já usava para instruir o modelo a não
desenhar texto na imagem.

**Nomenclatura atualizada em cascata**

`IMAGEN_MODEL` → `GEMINI_IMAGE_MODEL` (env var, default `gemini-2.5-flash-image`) em
`deploy.yml`/`.env.example`/`generation.routes.ts`; `IMAGEN_4_STANDARD_USD_PER_IMAGE` →
`GEMINI_IMAGE_USD_PER_IMAGE` e `estimateImagenCostUsd` → `estimateGeminiImageCostUsd` em
`AiPricing.ts` (mesma estimativa de $0.04/imagem — sem tabela pública oficial de preço para o
novo modelo no momento da correção, mantido o mesmo valor aproximado até haver fonte melhor). O
identificador de operação gravado em `AiUsageEvent` (`operation: 'imagen-generation'`) foi
mantido — é só um rótulo histórico de rastreamento, trocar quebraria a continuidade de leitura
dos eventos já gravados sem nenhum ganho.

## What this does not solve

Não migra nem corrige nenhum `Post` que já tenha ficado com `status: 'failed'` por causa deste
bug — esses rascunhos simplesmente não existem (a geração nunca chegou a criar um `Post`, só um
`GenerationRequest` marcado como falho), então não há nada para reparar retroativamente, só a
publicação futura volta a funcionar. Não monitora proativamente se o Google descontinuar
`gemini-2.5-flash-image` no futuro — o mesmo tipo de falha silenciosa (tick falha todo dia, sem
alerta visível fora do histórico do tick) pode se repetir se isso acontecer de novo; nenhum
alerta proativo foi adicionado nesta correção.

## References

- [_local-edr-policy-070-google-genai-thinking-desligado](070-migracao-google-genai-thinking-desligado.md) - Migração anterior de SDK (@google-cloud/vertexai → @google/genai) para as classes de texto, mesmo SDK que este EDR estende para a classe de imagem
- [_local-edr-policy-038-tick-de-autonomia-implementacao](038-tick-autonomia-implementacao.md) - Tick de autonomia cujo histórico (ação + erro por tentativa) foi o que permitiu diagnosticar esta falha sem acesso a logs de produção
