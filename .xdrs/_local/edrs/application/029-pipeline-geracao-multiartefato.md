---
name: _local-edr-policy-029-geracao-multiartefato-sem-bifurcacao
description: Define como GenerateContentUseCase orquestra copy, CTA e N imagens em um único loop sem bifurcar lógica entre post único e carrossel, e como falha parcial de artefato é tolerada. Use ao implementar ou estender GenerateContentUseCase, GeminiCopyGenerator, ImagenImageGenerator, ou as rotas de geração em apps/generator e apps/api.
apply-to: apps/generator — use-cases/GenerateContentUseCase, infrastructure/vertexai, infrastructure/storage/GcsImageStorage, routes/generation.routes; apps/api — routes/generation.routes
valid-from: 2026-06-19
---

# _local-edr-policy-029: Geração Multiartefato sem Bifurcação

## Context and Problem Statement

[_local-adr-policy-028-geracao-de-conteudo-multiartefato](../../adrs/application/028-geracao-multiartefato.md) decide que `GenerationRequest.outputs.artifacts: GenerationArtifact[]` representa tanto post único (`length 1`) quanto carrossel (`length N`) como o mesmo agregado, sem bifurcação de lógica. Falta definir, no nível de implementação, como o use-case itera sobre os artefatos, como falha parcial é tratada, e como copy/CTA/imagem se conectam aos adapters de Vertex AI.

## Decision Outcome

**`GenerateContentUseCase.execute()` roda um único `for` sobre `Array.from({ length: input.artifactCount })` independente do valor de `artifactCount` — não há `if (artifactCount === 1)` em nenhum ponto do fluxo.**

```typescript
const artifacts: GenerationArtifact[] = []
for (let position = 0; position < input.artifactCount; position++) {
  try {
    const image = await this.imageGenerator.generateImage({
      description: input.description,
      brandTokens,
      position,
      totalArtifacts: input.artifactCount,
    })
    const path = await this.imageStorage.upload(image, ...)
    artifacts.push({ position, status: 'ready', imageStoragePath: path, error: null })
  } catch (err) {
    artifacts.push({ position, status: 'failed', imageStoragePath: null, error: String(err) })
  }
}
```

### Details

**Falha de copy é fatal; falha de artefato é tolerada se ao menos um sobreviver**

`generateCopy()` roda antes do loop de imagens — se lançar, `GenerationRequest.status` vai para `failed` imediatamente e nenhuma imagem é gerada (não há copy para acompanhar um carrossel sem texto). Já artefatos individuais são isolados em `try/catch` dentro do loop: um `position` falho não interrompe os demais. Ao final, `Post` só é criado (`status: 'ai-draft'`) se `artifacts.some(a => a.status === 'ready')`; se todos falharem, `GenerationRequest.status` vai para `failed` e nenhum `Post` é criado.

**CTA nasce do mesmo prompt de copy, condicionado a `format` e `pautaContext`**

`CopyGeneratorPort.generateCopy()` recebe `format: 'single' | 'carousel'` (derivado de `artifactCount > 1`) e `pautaContext: { headline, rationale } | null` (resolvido via `topicSuggestionId` quando presente, usando `TopicSuggestionRepository.findById`). `GeminiCopyGenerator` injeta essas duas informações como instrução textual no mesmo prompt que pede as copies por plataforma — uma chamada ao Gemini retorna `{ copies, cta }` via `responseMimeType: 'application/json'`, evitando uma segunda chamada de IA só para o CTA.

**Brand tokens viram texto de prompt, nunca pós-processamento de imagem**

`ImageGeneratorPort.generateImage()` recebe `brandTokens: { primaryColor, secondaryColor, typography } | null` lido do `BrandProfile.visual` mais recente. `ImagenImageGenerator` concatena essas informações como instrução em português dentro do prompt enviado ao endpoint REST `predict` do Imagen — não há composição determinística de cor/tipografia sobre o bitmap retornado. Overlay programático fica para fase futura.

**Imagen é chamado via REST direto, não pelo SDK `@google-cloud/vertexai`**

O SDK `@google-cloud/vertexai` cobre apenas Gemini; `ImagenImageGenerator` autentica com `GoogleAuth.getAccessToken()` (pacote `google-auth-library`, adicionado como dependência direta de `apps/generator` pois antes só existia transitivamente) e faz `POST` ao endpoint `:predict` da API Vertex AI, extraindo `predictions[0].bytesBase64Encoded`.

**Progresso por artefato é persistido incrementalmente**

`GenerationRequestRepository.updateOutputs()` é chamado após cada artefato (não só ao final do loop), permitindo que um cliente consultando `GET /generation-requests/:id` durante a execução veja `artifacts` com status individuais (`pending`/`generating`/`ready`/`failed`) em vez de esperar o array completo.

**Pipeline roda síncrono dentro do request/response, sem fila**

`POST /generate` em `apps/generator` executa copy + N imagens + uploads na mesma requisição HTTP, apoiado no timeout de 120s já configurado para o Cloud Run do `generator` ([_local-edr-policy-007-cloud-run-deployment](../../edrs/infra/007-cloud-run.md)). Não há job assíncrono ou fila — mesmo padrão síncrono de `SuggestTopicsUseCase`.

**`generator` ganha repositório Firestore próprio de `Post` e de `GenerationRequest`**

Reaplicando o precedente de [_local-edr-policy-024](024-pipeline-pauta-verificacao-sugestao.md): `FirestorePostRepository` em `generator` é cópia da implementação de `api` (necessária para criar o `Post` ao final da geração); `FirestoreGenerationRequestRepository` é nova, usando `collectionGroup('generation_requests').where('id', '==', id)` para `findById`/`updateStatus`/`updateOutputs`/`delete` — mesma consulta de igualdade de campo único já usada sem índice composto explícito por `FirestorePostRepository.findById`.

**Proxy `api → generator` reutiliza o padrão de `/pauta-suggestions`**

`apps/api/src/routes/generation.routes.ts` expõe `POST /generation-requests` e `GET /generation-requests/:id`, ambos autenticados por Firebase, fazendo a chamada equivalente a `{GENERATOR_URL}/generate` e `{GENERATOR_URL}/generation-requests/:id` com `X-Internal-Secret` e `request.userId` como `brandId` — mesmo padrão de proxy já usado para `pauta-suggestions` e `audience-signal`.

## What this does not solve

Composição visual de marca sobre a imagem gerada (overlay de cor/logo/tipografia), edição manual de um artefato específico de um carrossel já gerado, e geração assíncrona em fila para `artifactCount` grandes são decisões de fase futura, fora do escopo da Fase 3.

## References

- [_local-adr-policy-028-geracao-de-conteudo-multiartefato](../../adrs/application/028-geracao-multiartefato.md) - Decisão estrutural que este EDR implementa
- [_local-edr-policy-024-pipeline-de-pauta-verificacao-e-sugestao](024-pipeline-pauta-verificacao-sugestao.md) - Precedente de proxy api→generator e de repositório Firestore próprio por serviço
- [_local-bdr-plan-002-roadmap-equipe-marketing-autonoma](../../bdrs/product/plans/002-roadmap-equipe-marketing-autonoma.md) - Fase 3, que origina esta decisão
- [_local-edr-policy-001-tdd-obrigatoria](../principles/001-tdd.md) - Testes que garantem tolerância a falha parcial e ausência de bifurcação de lógica
