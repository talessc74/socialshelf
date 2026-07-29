---
name: _local-edr-policy-070-google-genai-thinking-desligado
description: As 10 classes que chamam Gemini (texto e visão) usavam @google-cloud/vertexai, cujo GenerationConfig legado não expõe thinkingConfig — "thinking" do Gemini 2.5 Flash vem ligado por padrão (até 8192 tokens ocultos, cobrados) e não havia como desligar. Migrado para @google/genai (SDK unificado, já instalado transitivamente), com thinkingConfig: { thinkingBudget: 0 } em toda chamada. Use ao mexer em qualquer classe de apps/generator/src/infrastructure/vertexai/, ou ao decidir se algum call site específico precisa reativar thinking.
apply-to: apps/generator/src/infrastructure/vertexai/*.ts — geminiClient.ts (novo, cliente compartilhado), GeminiCopyGenerator, GeminiArtDirector, GeminiPerformanceSuggester, GeminiTopicQueryPlanner, GeminiTranslator, GeminiBrandDocumentExtractor, GeminiTopicAutonomyMatcher, GeminiCampaignCaptionWriter, GeminiPatternAnalyzer, GeminiAudienceFitScorer; apps/generator/package.json
valid-from: 2026-07-29
---

# _local-edr-policy-070: Google GenAI, thinking desligado

## Context and Problem Statement

Investigação de custo do Google Cloud (fatura Jan-Jul 2026, R$636,09) apontou Vertex
AI como o maior item (R$434,55), a maior parte disso Imagen (fora de escopo deste
EDR). À parte, uma investigação separada confirmou que o Gemini 2.5 Flash roda com
"thinking" ligado por padrão em toda chamada de texto/visão — até 8.192 tokens de
raciocínio oculto, cobrados como qualquer outro token de saída, sem nenhum controle
do lado do SocialShelf.

O SDK instalado (`@google-cloud/vertexai@^1.9.2`, resolvido `1.12.0`) não permite
desligar isso: sua interface `GenerationConfig` (usada por `getGenerativeModel().
generateContent()`) simplesmente não tem campo `thinkingConfig` — confirmado lendo o
`.d.ts` do pacote. As 10 classes do projeto que falam com Gemini (copy, direção de
arte, sugestão de performance, planejamento de busca, tradução, extração de
documento de marca, autonomia de tópico, legenda de campanha, análise de padrão,
aderência de audiência) usam todas esse mesmo padrão.

## Decision Outcome

**Migrar as 10 classes de `@google-cloud/vertexai` para `@google/genai` (SDK
unificado do Google, já presente transitivamente via a própria dependência interna
do `@google-cloud/vertexai`), com `thinkingConfig: { thinkingBudget: 0 }` em toda
chamada — thinking desligado por padrão em 100% das chamadas de texto/visão do
projeto.**

### Details

**`@google/genai` como dependência direta, `@google-cloud/vertexai` removido**

`apps/generator/package.json` trocou `@google-cloud/vertexai` por
`@google/genai@^1.52.0`. Nenhum outro arquivo do monorepo usava o SDK antigo
(confirmado via grep em `apps/api` e `apps/generator`) — a remoção não quebra nada
fora deste diretório. `ImagenImageGenerator.ts` já não usava o SDK do Vertex (REST
direto), não foi tocado.

**Cliente compartilhado (`geminiClient.ts`, novo)**

As 10 classes construíam o mesmo cliente de forma idêntica, letra por letra. Extraído
para `createGeminiClient(projectId, location)`, retornando `GoogleGenAI({ vertexai:
true, project, location, ...(location === 'global' && { httpOptions: { baseUrl:
'https://aiplatform.googleapis.com' } }) })` — `httpOptions.baseUrl` é o equivalente
moderno do antigo `apiEndpoint`, mesma condição de ativação (`location === 'global'`,
usada porque `GEMINI_LOCATION` tem esse valor por padrão).

**`thinkingConfig: { thinkingBudget: 0 }` em toda chamada, sem exceção**

Adicionado ao `config` de todas as 10 chamadas (inclusive `GeminiBrandDocumentExtractor`,
que não define `responseMimeType`). Nenhuma classe ficou de fora — nem as que fazem
julgamento mais "criativo" (direção de arte, classificação semântica de tópico/
audiência). Se alguma delas se mostrar pior sem thinking, a correção é pontual nessa
classe (reativar com um budget explícito), não um "manter thinking ligado por via das
dúvidas" geral — o padrão do projeto é desligado.

**Desvios de cada classe preservados**

`GeminiTranslator` e `GeminiAudienceFitScorer` mantêm o retorno antecipado antes de
construir o cliente (lista vazia → não chama IA). `GeminiTopicAutonomyMatcher` mantém
o curto-circuito de 0-1 preferência de estilo sem tópicos configurados.
`GeminiBrandDocumentExtractor` e `GeminiCampaignCaptionWriter` mantêm `contents` como
array multimodal (`inlineData` com o documento/foto anexada) em vez de string.
`GeminiBrandDocumentExtractor` continua sem `responseMimeType: 'application/json'` e
com o strip manual de cerca de markdown antes do `JSON.parse` — não foi uma correção
oportunista, é fora de escopo deste EDR.

**Parsing simplificado**

`result.response.candidates?.[0]?.content.parts[0]?.text` (SDK antigo) virou
`result.text` — getter novo do SDK que já exclui partes de "thought" da resposta.
Comportamento equivalente já que thinking está desligado em toda chamada.

## What this does not solve

Não mede nem expõe ao usuário quanto cada chamada custa — isso é o próximo passo
(mensuração por conta/fase), ainda não implementado. Não adiciona trava de gasto
nem cache/dedup de chamadas repetidas (ex.: "regenerar este card" em
`EditArtifactUseCase`). Não decide se algum call site específico volta a precisar de
thinking — fica para quando (e se) alguma classe mostrar qualidade pior sem ele, com
essa necessidade medida e visível, não assumida de antemão.

## References

- Nenhum EDR anterior tratava do SDK de chamada ao Gemini diretamente — primeira
  policy dedicada a esta camada.
