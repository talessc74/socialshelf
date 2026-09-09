---
name: _local-edr-policy-078-retry-em-429-na-geracao-de-imagem
description: GeminiImageGenerator (sucessora do Imagen, _local-edr-policy-077) falhava com 429 RESOURCE_EXHAUSTED ao gerar as 5 variações de artifact de um post em paralelo — cota de requisições-por-minuto do projeto pro modelo. generateImage agora tenta de novo (até 3x, 5s de intervalo) só para esse status; qualquer outro erro continua lançando na primeira tentativa. Use ao mexer em GeminiImageGenerator.generateImage.
apply-to: apps/generator — GeminiImageGenerator (generateImage)
valid-from: 2026-09-09
---

# _local-edr-policy-078: Retry em 429 na geração de imagem

## Context and Problem Statement

Usuário testou "Gerar com IA" manualmente, algumas horas depois do deploy de
`_local-edr-policy-077` (migração de Imagen para Gemini Image), e recebeu:

```
Falhou
{"error":{"code":429,"message":"Resource exhausted. Please try again later. Please refer
to https://cloud.google.com/vertex-ai/generative-ai/docs/error-code-429 for more
details.","status":"RESOURCE_EXHAUSTED"}}
```

Só na 5ª de 5 variações de artifact — as outras 4 geraram normalmente. Diferente do 404 que
motivou o EDR-077 (modelo inexistente, todas as chamadas falhavam), este é um erro novo e mais
benigno: `GenerateContentUseCase` dispara as N variações via `Promise.all` (todas em paralelo), e
a cota de requisições-por-minuto do projeto para `gemini-2.5-flash-image` não aguenta esse pico —
o Imagen antigo (endpoint `:predict` separado) aparentemente tinha uma cota independente e mais
folgada que não era exercitada pelo mesmo teto.

Como `GenerateContentUseCase` só marca o post inteiro como `failed` se **todas** as artes
falharem (linha "All artifacts failed to generate"), esse caso específico não travaria uma
publicação automática — mas em cargas maiores (mais variações, mais posts simultâneos) o mesmo
429 poderia derrubar artes suficientes pra zerar o total.

## Decision Outcome

**`GeminiImageGenerator.generateImage` tenta de novo (até 3 vezes, 5s de intervalo) quando o
erro é especificamente `ApiError` com `status === 429`; qualquer outro erro (prompt rejeitado,
permissão, etc.) continua lançando na primeira tentativa.**

### Details

**Retry na chamada individual, não na geração do post inteiro**

Cada `generateImage` já roda isolado dentro do `Promise.all` de `GenerateContentUseCase` — dar
retry ali dentro (via `generateContentWithRateLimitRetry`) é suficiente e não exige tocar no
use-case nem no padrão de paralelismo das artes.

**Filtro estrito por status via `ApiError` do `@google/genai`, não por status HTTP genérico**

`@google/genai` expõe `ApiError extends Error` com um campo `status: number` (o código HTTP).
Só `status === 429` é candidato a retry — o mesmo princípio de `_local-edr-policy-058`
(retry em `código/subcódigo` exato do Instagram): mascarar um prompt rejeitado ou erro de
permissão atrás de tentativas repetidas seria pior diagnóstico, não melhor.

**3 tentativas, 5s de intervalo — intervalo fixo, não exponencial**

Segue o mesmo padrão de `MetaPublisher.publishInstagram` (`PUBLISH_RETRY_MAX_ATTEMPTS` /
`PUBLISH_RETRY_DELAY_MS`, ambos fixos): 3×5s (até 15s por arte) é o suficiente pra absorver um
pico de cota por-minuto sem impor um total muito acima do tempo que a geração de uma arte já leva
sozinha, mesmo com até 5 artes retentando em paralelo ao mesmo tempo.

## What this does not solve

Não aumenta a cota real do projeto na Vertex AI — só absorve picos curtos com retry. Se o volume
de gerações crescer (mais marcas em autonomia, mais variações por post), a cota em si pode
precisar de aumento manual no Google Cloud Console; isso é uma ação de infraestrutura fora do
escopo deste EDR. Também não limita a concorrência das 5 chamadas em `GenerateContentUseCase`
(elas continuam todas em paralelo) — se isso se provar insuficiente, a próxima iteração natural
seria limitar quantas rodam ao mesmo tempo (ex.: `mapWithConcurrency`, já usado em
`apps/api/src/use-cases/campaigns`), não mais retry.

## References

- [_local-edr-policy-077-migracao-de-imagen-para-gemini-image](077-migracao-imagen-para-gemini-image.md) - Migração que trocou o Imagen (404, todas as artes falhavam) pelo Gemini Image (429 pontual, exposto por este EDR)
- [_local-edr-policy-058-retry-em-media-nao-pronta-do-instagram](058-retry-instagram-media-nao-pronta.md) - Precedente de retry restrito a um código/status exato, mesmo padrão de implementação (`MetaPublisher.publishInstagram`) seguido aqui
