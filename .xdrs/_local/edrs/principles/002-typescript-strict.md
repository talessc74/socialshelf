---
name: _local-edr-policy-002-typescript-strict
description: Define as flags TypeScript obrigatórias em todo o monorepo SocialShelf. Use ao criar novos packages, configurar tsconfig ou avaliar erros de tipo.
apply-to: Todos os packages e apps do monorepo
valid-from: 2026-06-06
---

# _local-edr-policy-002: TypeScript Strict Mode

## Context and Problem Statement

TypeScript com configurações permissivas permite categorias inteiras de bugs em tempo de execução que poderiam ser capturados em tempo de compilação — especialmente acesso a índices de array não verificados e propriedades opcionais tratadas como obrigatórias.

Quais flags TypeScript são obrigatórias para garantir segurança de tipos em todo o monorepo?

## Decision Outcome

**`strict: true` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` em toda a base de código**

Configuração centralizada em `packages/tsconfig` — todos os apps e packages estendem a config base sem sobrescrever flags de segurança.

### Details

**Flags obrigatórias (em `packages/tsconfig/base.json`)**

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler"
  }
}
```

**O que cada flag impõe**

- `strict: true` — ativa `strictNullChecks`, `strictFunctionTypes`, `strictBindCallApply`, `strictPropertyInitialization`, `noImplicitAny`, `noImplicitThis`, `alwaysStrict`.
- `noUncheckedIndexedAccess` — acesso a `array[i]` ou `record[key]` retorna `T | undefined`, forçando verificação explícita antes do uso.
- `exactOptionalPropertyTypes` — `{ prop?: string }` não aceita `{ prop: undefined }` — propriedades ausentes e propriedades explicitamente `undefined` são tipos distintos.

**Configs por contexto**

| Config | Estende | Adições |
|---|---|---|
| `base.json` | — | Flags base + ES2022 |
| `node.json` | `base.json` | `outDir: dist`, `rootDir: src` |
| `nextjs.json` | `base.json` | ES2017, `jsx: preserve`, plugins Next.js, `paths: @/*` |

**O que não é permitido**

- Sobrescrever `strict`, `noUncheckedIndexedAccess` ou `exactOptionalPropertyTypes` para `false` em qualquer `tsconfig.json` de app ou package.
- Usar `@ts-ignore` sem comentário explicando o motivo e criando issue para remover.
- Usar `as any` exceto em pontos de integração com SDKs externos sem tipagem adequada — documentar com comentário.

## References

- [_local-adr-policy-002-monorepo-pnpm-turbo](../../adrs/application/002-monorepo-pnpm-turbo.md) - Estrutura de packages compartilhados
