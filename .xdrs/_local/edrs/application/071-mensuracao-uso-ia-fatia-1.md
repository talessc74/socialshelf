---
name: _local-edr-policy-071-mensuracao-de-uso-de-ia-fatia-1
description: Base de mensuração de uso de IA (AiUsageEvent, custo estimado, Firestore) instrumentada nos dois pontos que concentram a maior parte do gasto real — geração de conteúdo (copy + direção de arte + Imagen) e "regenerar card". Nunca bloqueia nem falha uma geração real. Use ao mexer em GenerateContentUseCase, EditArtifactUseCase, qualquer classe de apps/generator/src/infrastructure/vertexai/, ou ao instrumentar os 7 pontos de chamada de IA restantes (fatia 2).
apply-to: packages/domain — entities/AiUsageEvent.ts, value-objects/AiPricing.ts, ports/AiUsageRecorderPort.ts, ports/CopyGeneratorPort.ts, ports/ArtDirectorPort.ts, ports/ImageGeneratorPort.ts; apps/generator — infrastructure/firestore/FirestoreAiUsageRepository.ts, infrastructure/vertexai/geminiClient.ts, infrastructure/vertexai/GeminiCopyGenerator.ts, infrastructure/vertexai/GeminiArtDirector.ts, infrastructure/vertexai/ImagenImageGenerator.ts, use-cases/GenerateContentUseCase.ts, use-cases/EditArtifactUseCase.ts, routes/generation.routes.ts; firestore.indexes.json
valid-from: 2026-07-29
---

# _local-edr-policy-071: Mensuração de uso de IA, fatia 1

## Context and Problem Statement

Decisão do usuário (sessão de revisão de fatura do Google Cloud): antes de ter usuários
pagantes, o produto precisa medir quanto cada conta gasta com IA, separado por conta e por
fase (texto vs imagem) — base tanto de uma tela de gastos mensais quanto de uma futura trava de
gasto diária em R$.

Mapeamento prévio (Explore) encontrou 11 pontos de chamada de IA no generator-service. Nenhum
port hoje carrega `brandId`, e instrumentar todos de uma vez seria uma mudança grande (~40-60
arquivos, incluindo 2 pontos — extração de documento de marca e classificação de autonomia de
tópico — que exigem plumbing extra em apps/api e apps/publisher, porque nem brandId chega até
eles hoje). Fatiado em duas entregas pra não virar um diff grande demais pra revisar com
segurança.

## Decision Outcome

**Fatia 1: base de mensuração completa (evento, custo estimado, Firestore) instrumentada nos
dois pontos que concentram a maior parte do gasto real — `GenerateContentUseCase` (copy + direção
de arte + Imagen, toda geração de post) e `EditArtifactUseCase` (Imagen, "regenerar card"). Os 7
pontos restantes ficam para uma fatia 2.**

### Details

**`AiUsageEvent` e `AiUsageRecorderPort` (packages/domain, novo)**

Um evento por chamada de IA: `brandId`/`userId`, `category` (`'text-generation'` |
`'image-generation'` — a separação por fase que o usuário pediu), `operation` (granularidade
abaixo de category: `'copy-generation'`, `'art-direction'`, `'imagen-generation'`), tokens reais
(`promptTokenCount`/`candidatesTokenCount`/`thoughtsTokenCount`, vindos de
`usageMetadata` da resposta do Gemini — nunca estimados a priori) e `estimatedCostUsd`.
`AiUsageRecorderPort.record()` **nunca lança** — é contrato explícito na interface — porque medir
uso é observabilidade, uma falha de gravação (rede, índice faltando) não pode derrubar uma
geração de conteúdo real.

**Custo em USD, não R$ (`AiPricing.ts`)**

`estimateGeminiCostUsd`/`estimateImagenCostUsd` usam preço público de lista da Vertex AI
(Gemini 2.5 Flash: $0.30/1M tokens entrada, $2.50/1M saída, confirmado em
cloud.google.com/vertex-ai/generative-ai/pricing; Imagen 4 Standard: $0.04/imagem, estimativa de
fontes secundárias — Google não expõe isso na mesma tabela do Gemini). Guardado em USD porque é o
que a Vertex AI realmente cobra e não distorce com câmbio histórico; a conversão pra R$ (pedida
pelo usuário) fica pra quando a tela de gastos for construída, usando uma taxa de câmbio
configurável no momento da exibição — nunca gravada no evento. **Isto é uma estimativa de preço de
lista, não reconciliação com a fatura real** (que tem desconto/crédito) — não usar para
contabilidade financeira.

**`brandId`/`userId` entram nos inputs dos ports, não como parâmetro extra**

`ContentInputs`, `ArtDirectionInput` e `ImagePrompt` ganharam `brandId`/`userId`. Cogitado
adicionar como segundo parâmetro posicional em `generateCopy(inputs, brandId)`, descartado porque
quebraria todo teste existente que usa `toHaveBeenCalledWith(expect.objectContaining({...}))`
(que assume um único argumento) — colocar dentro do objeto de input existente é aditivo, zero
teste quebrado.

**`geminiClient.ts` ganha `recordGeminiUsage()` compartilhado**

Mesma lógica de "extrai usageMetadata → estima custo → chama record() sem esperar" seria
duplicada em cada classe Gemini instrumentada — extraída uma vez, chamada por
`GeminiCopyGenerator`/`GeminiArtDirector` logo após `ai.models.generateContent()`.
`ImagenImageGenerator` grava direto (não passa por `recordGeminiUsage`, que é específico de
tokens de texto) só depois de confirmar que a predição teve sucesso — uma falha da API nunca gera
um evento de custo fantasma.

**Firestore: mesma nested collection de `generation_requests`**

`users/{userId}/brands/{brandId}/ai_usage_events`, consultada via `collectionGroup` — mesmo
padrão e mesmo formato de índice composto (`brandId` + `createdAt`) já usado por
`generation_requests`, evitando introduzir um segundo layout de dados só para esta feature.

## What this does not solve

**Fatia 2** (não feita ainda): os outros 7 pontos de chamada de IA (planejamento de busca,
tradução, extração de documento de marca, classificação de autonomia de tópico, legenda de
campanha, sugestão de performance, análise de padrão) — menor volume/custo cada, dois deles
(extração de documento, autonomia de tópico) exigem plumbing de brandId em apps/api/apps/publisher
primeiro. Não constrói a tela de gastos mensais nem a trava de gasto diária com pausa+e-mail —
dependem desta base existir primeiro. Não converte para R$ em lugar nenhum ainda.

## References

- Nenhum EDR anterior tratava de mensuração de custo de IA — primeira policy do assunto.
- `_local-edr-policy-070-google-genai-thinking-desligado` — `thoughtsTokenCount` medido aqui
  existe para verificar que o padrão "thinking desligado" continua valendo na prática.
