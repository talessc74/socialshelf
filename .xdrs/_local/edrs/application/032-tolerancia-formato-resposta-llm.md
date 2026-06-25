---
name: _local-edr-policy-032-tolerancia-de-forma-na-resposta-do-gemini
description: Define como adapters Gemini* em apps/generator devem tratar campos de lista que o modelo ocasionalmente retorna como string única em vez de array, normalizando antes de validar com zod em vez de rejeitar a resposta inteira. Use ao implementar ou revisar qualquer parser de resposta JSON do Gemini que valide o resultado com safeParse.
apply-to: apps/generator — adapters Gemini* em infrastructure/vertexai que validam resposta JSON do modelo via zod safeParse
valid-from: 2026-06-25
---

# _local-edr-policy-032: Tolerância de Forma na Resposta do Gemini

## Context and Problem Statement

[_local-edr-policy-012-zod-safeparse-validacao-de-input](012-zod-validation.md) estabelece safeParse() em toda entrada externa, com erro explícito em caso de falha — mas trata a entrada como teste binário (válida ou inválida). A resposta do Gemini não é input estruturado por um cliente HTTP: é texto gerado por um modelo que pode variar a forma de um campo entre chamadas mesmo com o mesmo prompt — por exemplo, devolver `"08:00, 14:00"` em vez de `["08:00", "14:00"]` para um campo de lista. `GeminiPatternAnalyzer.analyzePatterns()` rejeitava esse retorno por completo via `profileDiagnosticSchema.safeParse()`, derrubando a tela de Diagnóstico do Perfil mesmo quando o restante da resposta era válido.

Como validar resposta de Gemini quando o desvio de forma é uma variação esperada do modelo, e não um input malformado a ser rejeitado?

## Decision Outcome

**Normalizar a forma antes de validar com `z.preprocess()`, mantendo o contrato de domínio (`string[]`) intacto.**

```typescript
const stringArray = z.preprocess(
  (val) => (typeof val === 'string' ? val.split(',').map((s) => s.trim()).filter(Boolean) : val),
  z.array(z.string()),
)
```

Campos de lista no schema de resposta do Gemini (`topFormats`, `bestTimes` em `profileDiagnosticSchema`) usam `stringArray` em vez de `z.array(z.string())` direto. Se o modelo devolver string, ela é convertida em array antes da validação interna rodar; se já vier como array, o preprocess é transparente.

### Details

**O contrato de domínio não muda — só o ponto de tolerância**

`ProfileDiagnostic.bestTimes` continua `string[]` em `@socialshelf/domain`; consumidores como `GeminiPerformanceSuggester` (`bestTimesSection = diagnostic.bestTimes.join(', ')`) não precisam de ajuste. A tolerância vive exclusivamente no limite onde a resposta do modelo é convertida para o tipo de domínio — nunca depois desse limite.

**Falha que sobrevive à normalização continua fatal**

Campo obrigatório ausente, JSON inválido, ou tipo que não é nem string nem array seguem rejeitados com erro descritivo (`Gemini returned a diagnostic that doesn't match the expected shape: ...` / `Gemini returned invalid JSON for pattern analysis`) — o preprocess resolve apenas o desvio de forma já observado, não substitui a validação.

**Extensão a outros adapters Gemini é decisão do momento em que o desvio se repetir**

Este EDR não estende `stringArray` a campos estruturalmente parecidos em outros adapters (ex.: `basedOnThemes` em `GeminiPerformanceSuggester`) que ainda não apresentaram o mesmo desvio.

## What this does not solve

Outros desvios de forma do Gemini (campo numérico como string, objeto aninhado plano, etc.) — cada novo padrão observado deve ser avaliado e, se recorrente, tratado com o mesmo princípio de normalizar-antes-de-validar.

## References

- [_local-edr-policy-012-zod-safeparse-validacao-de-input](012-zod-validation.md) - safeParse() como base; este EDR adiciona normalização específica para resposta de LLM
- [_local-edr-policy-024-pipeline-de-pauta-verificacao-e-sugestao](024-pipeline-pauta-verificacao-sugestao.md) - Precedente de adapter Gemini com safeParse em apps/generator
- [_local-edr-policy-001-tdd-obrigatoria](../principles/001-tdd.md) - Testes que cobrem a normalização string→array e os casos de rejeição que permanecem fatais
