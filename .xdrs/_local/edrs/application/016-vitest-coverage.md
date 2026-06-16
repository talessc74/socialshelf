---
name: _local-edr-policy-016-vitest-e-cobertura-v8
description: Define Vitest com V8 como stack de testes unitários. Use ao configurar testes em novo pacote ou ao interpretar relatórios de cobertura.
apply-to: Todos os apps e packages com testes unitários
valid-from: 2026-06-16
---

# _local-edr-policy-016: Vitest e Cobertura V8

## Context and Problem Statement

O monorepo precisa de um runner de testes consistente entre todos os pacotes, integrado ao pipeline CI e capaz de gerar relatórios de cobertura para análise. Jest foi considerado mas requer configuração adicional para ESM e TypeScript em monorepo pnpm.

Como configurar testes unitários de forma consistente em todos os pacotes do monorepo?

## Decision Outcome

**Vitest como runner de testes com V8 como provider de cobertura — configuração mínima por pacote**

### Details

**Configuração padrão (`vitest.config.ts`)**

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      exclude: ['src/index.ts', 'src/**/*.test.ts'],
    },
  },
})
```

**Por que Vitest**

- Configuração nativa para ESM e TypeScript — sem transformações extras
- API compatível com Jest — curva de aprendizado mínima
- Watch mode integrado com HMR para desenvolvimento
- Performance superior em monorepos com muitos pacotes

**Por que V8**

- Cobertura nativa do Node.js — sem instrumentação de código
- Mais preciso para TypeScript compilado para ESM
- Sem dependência de Babel ou instrumentação de source maps customizada

**Reporters**

- `text`: cobertura no terminal durante CI
- `lcov`: arquivo `coverage/lcov.info` para integração com ferramentas de análise de cobertura

**Convenção de arquivo de teste**

`*.test.ts` no mesmo diretório do arquivo testado. Nunca em diretório `__tests__/` separado — proximidade facilita navegação e manutenção.

**Scripts no `package.json` por app**

```json
{
  "test": "vitest run",
  "test:coverage": "vitest run --coverage"
}
```

## References

- [_local-edr-policy-001-tdd-obrigatoria](../principles/001-tdd.md) - TDD como prática que precede a execução de testes
- [_local-edr-policy-005-ci-pipeline](../devops/005-ci-pipeline.md) - `test:coverage` executado no pipeline CI
