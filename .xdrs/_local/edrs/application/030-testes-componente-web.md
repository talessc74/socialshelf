---
name: _local-edr-policy-030-testes-de-componente-em-apps-web
description: Define como testar componentes React em apps/web com Vitest + Testing Library — ambiente jsdom, mocking de next/navigation e do cliente api, cleanup entre testes. Use ao escrever o primeiro teste de uma página/componente em apps/web ou ao revisar por que um teste de componente está deixando estado entre casos.
apply-to: apps/web — qualquer arquivo *.test.tsx em src/app ou src/components
valid-from: 2026-06-19
---

# _local-edr-policy-030: Testes de Componente em apps/web

## Context and Problem Statement

[_local-edr-policy-016-vitest-e-cobertura-v8](016-vitest-coverage.md) define Vitest como runner para todo o monorepo, mas `apps/web` nunca teve nenhum teste — não havia ambiente DOM, biblioteca de renderização de componente, nem convenção de mock para `next/navigation` ou para o cliente `lib/api.ts`. A galera de QA, ao revisar a tela `GenerateContentPage` (Fase 3), encontrou essa lacuna e decidiu fechá-la junto com o teste da tela, em vez de fazer apenas uma revisão manual descartável.

Como testar um componente de página Next.js (App Router, `'use client'`, React Query) de forma consistente com o resto do monorepo?

## Decision Outcome

**Vitest com `environment: 'jsdom'` e `@testing-library/react`, configuração própria por app de `apps/web` (não compartilhada com o `vitest.config.ts` de `node` usado em `api`/`generator`/`generator`).**

```typescript
// apps/web/vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.tsx'],
    coverage: { provider: 'v8', reporter: ['text', 'lcov'], include: ['src/**/*.tsx'] },
  },
})
```

### Details

**Cleanup entre testes não é automático — precisa de `afterEach(cleanup)` explícito**

Sem `globals: true` no config (mantendo o padrão de import explícito de `describe/it/expect` já usado em `api`/`generator`), o cleanup do Testing Library entre testes também não é automático. `apps/web/vitest.setup.ts` chama `cleanup()` manualmente em `afterEach` — sem isso, renders de testes anteriores continuam no DOM e queries como `getByText` lançam "multiple elements found" em qualquer segundo teste do mesmo arquivo.

```typescript
// apps/web/vitest.setup.ts
import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => cleanup())
```

**`@vitejs/plugin-react` fixado em `^4.x`, não `^6.x`**

A versão major mais recente do plugin exige `vite@^8`, mas o monorepo resolve `vite@5.4.x` via outras dependências (Next.js 14, Vitest 2.x) — instalar `^6` quebra o peer dependency. `^4.7.0` é compatível com Vite 5 e com Vitest 2.x já usado nos outros apps.

**`next/navigation` é mockado por completo, nunca importado de verdade**

`vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), back: vi.fn() }) }))` — o App Router não tem um runtime de teste oficial leve; mockar apenas os métodos usados pela página evita depender de um polyfill de roteador completo.

**`lib/api.ts` é mockado por completo; cada teste configura o retorno por caso**

`vi.mock('../../../lib/api', () => ({ api: { getConnections: vi.fn(), ... } }))` seguido de `vi.mocked(api, true)` para tipar os mocks. Isso evita qualquer chamada de rede real (a página nunca chega perto de `fetch`) e mantém o teste determinístico — mesmo padrão de isolamento que `vi.stubGlobal('fetch', ...)` já usa em `apps/api`/`apps/generator`, adaptado para o cliente HTTP do lado do navegador.

**Página envolvida em `QueryClientProvider` com `retry: false`**

Toda página que usa `useQuery` precisa do provider no teste; `retry: false` evita que uma falha simulada (`mockRejectedValue`) gere múltiplas tentativas e torne o teste lento ou flaky.

**Estado de carregamento síncrono é testado resolvendo a Promise manualmente**

Para verificar a tela de "Gerando…" (que existe porque a geração de conteúdo é síncrona e pode levar até 2 minutos — [_local-edr-policy-029](029-pipeline-geracao-multiartefato.md)), o mock de `generateContent` retorna uma `Promise` cujo `resolve` é capturado em uma variável e chamado manualmente após a asserção do estado de loading, em vez de usar `mockResolvedValue` (que resolveria antes do teste conseguir observar o estado intermediário).

## What this does not solve

Testes end-to-end em navegador real (Playwright/Cypress) e testes de páginas que dependem de Firebase Auth real (`login`, `dashboard/layout`) — esses exigiriam mock de SDK do Firebase ou um emulador, fora do escopo desta decisão.

## References

- [_local-edr-policy-016-vitest-e-cobertura-v8](016-vitest-coverage.md) - Runner de testes que esta decisão estende para `apps/web`
- [_local-edr-policy-029-geracao-multiartefato-sem-bifurcacao](029-pipeline-geracao-multiartefato.md) - Pipeline síncrono que motiva o teste do estado de carregamento
- [_local-edr-policy-001-tdd-obrigatoria](../principles/001-tdd.md) - TDD como prática que precede a escrita de qualquer componente novo em `apps/web` a partir desta decisão
