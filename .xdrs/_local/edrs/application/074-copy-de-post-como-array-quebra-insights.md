---
name: _local-edr-policy-074-copy-vira-array-quebra-insights
description: GeminiCopyGenerator confiava sem validar no formato interno de cada `copies[platform]` retornado pelo Gemini — quando o modelo devolvia "text" como um array de parágrafos em vez de string única, o Post nascia com content[].text array (nunca acontecia na tela de geração manual, que só mostra o headline/preview, mas contaminava o Post salvo), e o erro só aparecia bem depois, ao abrir Banco de Insights → Novas sugestões, como "Invalid request body" / "entries: Expected string, received array" vindo da validação estrita de GET /performance-insights/analyze. Use ao mexer em GeminiCopyGenerator, CopyGenerationResult, ou em qualquer schema downstream que assuma content[].text como string.
apply-to: apps/generator — infrastructure/vertexai/GeminiCopyGenerator.ts
valid-from: 2026-07-30
---

# _local-edr-policy-074: Copy vira array quebra Insights

## Context and Problem Statement

Usuário reportou: no modo automático, abrir Banco de Insights → aba "Novas sugestões" demorava
muito e então caía em erro — `Generator error: {"error":"Invalid request body","details":
{"fieldErrors":{"entries":["Expected string, received array"]}}}`.

A demora era esperada (a rota busca métricas ao vivo de todas as redes para todos os posts
publicados antes de analisar), mas o erro em si não fazia sentido à primeira vista: o schema
zod de `POST /performance-insights/analyze` já valida `entries` como array há tempos, e
`content: PlatformContent[]` do domínio já garante `text: string`. `flatten()` do zod agrupa
qualquer erro aninhado pelo primeiro segmento do path — então "entries" na mensagem não
significa que o campo `entries` em si estava errado, e sim que um campo dentro de um item do
array (aqui, `entries[i].text`) recebeu um array em vez de string.

Rastreando a origem: `GeminiCopyGenerator.toCopyGenerationResult()` validava que `copies` era um
`object` não-nulo, mas fazia `copies as CopyGenerationResult['copies']` sem checar o formato
interno de cada `{ text, charCount }` por plataforma. Quando o Gemini decidia devolver o texto
de uma plataforma como um array de parágrafos (`"text": ["Parágrafo 1.", "Parágrafo 2."]`) em
vez de uma única string — o mesmo tipo de inconsistência de formato que `_local-edr-policy-032`
já havia documentado para `bestTimes`/`topFormats` em `GeminiPatternAnalyzer`, só que na direção
oposta (lá um campo lista vinha como string; aqui um campo string vinha como lista) — esse
formato passava direto, sem erro, virava `Post.content[].text` armazenado como array, e só
quebrava muito mais tarde, quando outra rota validava estritamente essa mesma entrada.

## Decision Outcome

**`GeminiCopyGenerator` ganhou `normalizeCopies()`: valida o `text` de cada plataforma e, se vier
como array de strings, junta em uma única string (`\n\n`) em vez de deixar passar sem checar ou
rejeitar a geração inteira — `charCount` é sempre recalculado a partir do texto final, nunca
herdado do modelo.**

### Details

**Por que juntar em vez de rejeitar**

Rejeitar a geração inteira quando só um campo de uma plataforma veio em formato inesperado
desperdiçaria a chamada (headlines, visualBriefs e as demais plataformas já vieram certas) e
devolveria "falha na geração" ao usuário por um problema cosmético de formato. Juntar os
parágrafos com `\n\n` preserva a intenção do modelo (múltiplos parágrafos são normais numa
legenda longa) e produz um texto válido — mesma filosofia de tolerância de `_local-edr-policy-032`.

**`charCount` sempre recalculado**

Antes, `charCount` vinha direto do modelo sem verificação nenhuma — em `GenerateContentUseCase`,
só era recalculado quando o texto excedia o limite da plataforma (truncamento). Se o modelo
mandasse um `charCount` desalinhado do `text` real (ex.: contando só o primeiro parágrafo do
array original), o contador exibido no frontend ficaria errado silenciosamente. Agora
`normalizeCopies()` sempre recalcula `charCount = text.length` a partir do texto final, então
esse valor nunca pode dessincronizar do texto que ele descreve.

**Por que só surgia em Banco de Insights, não na tela de geração**

A tela de geração manual (`/dashboard/generate`) só exibe `headline`/preview renderizado na
imagem — nunca renderiza `content[].text` bruto na UI, então um `text` array ali não quebrava
visualmente nada, só ficava dormente no Post salvo. `GET /performance-suggestions` é o único
fluxo que revalida esse campo com um schema zod estrito (`z.string()`), e só roda depois que o
post já foi publicado e tem métricas — daí o atraso entre a causa (geração) e o sintoma (Banco
de Insights).

## What this does not solve

Não adiciona validação retroativa nem migração para Posts já salvos com `content[].text` como
array antes desta correção — se algum já existir em produção, `GET /performance-suggestions`
continuará falhando para a marca dona desse post específico até ele ser reeditado/republicado.
Não cobre outros campos de `CopyGenerationResult` (`cta`, `headlines`, `visualBriefs`,
`bodyTexts`) contra o mesmo tipo de inconsistência — esses já eram validados com
`.every((x) => typeof x === 'string')` antes desta mudança, então o risco já existia coberto
para eles.

## References

- [_local-edr-policy-032-tolerancia-formato-resposta-llm](032-tolerancia-formato-resposta-llm.md) - Mesmo princípio de tolerância a formato inconsistente do LLM, aplicado antes na direção oposta (lista veio como string)
- [_local-edr-policy-040-performance-sem-fetch-duplicado](040-performance-insights-sem-fetch-duplicado.md) - Endpoint onde o schema estrito finalmente expõe o dado malformado
