---
name: _local-edr-policy-004-next-js-14-app-router
description: Define Next.js 14 com App Router como padrão do frontend do SocialShelf. Use ao criar páginas, layouts, componentes ou configurar roteamento no apps/web.
apply-to: apps/web
valid-from: 2026-06-06
---

# _local-edr-policy-004: Next.js 14 App Router

## Context and Problem Statement

O frontend precisa de roteamento, SSR/SSG e integração com React Server Components. A escolha entre App Router e Pages Router define o modelo mental de toda a estrutura de páginas e data fetching.

Como estruturar o frontend Next.js para aproveitar React Server Components e manter consistência de roteamento?

## Decision Outcome

**Next.js 14 com App Router exclusivamente — sem uso do Pages Router**

Toda página, layout e componente de servidor usa a convenção de arquivos do App Router (`page.tsx`, `layout.tsx`, `loading.tsx`).

### Details

**Estrutura de diretórios (`apps/web/src/app/`)**

```
app/
├── page.tsx          ← landing/home
├── layout.tsx        ← root layout (Providers, fontes globais)
├── globals.css
├── login/
│   └── page.tsx
└── dashboard/
    ├── layout.tsx    ← layout autenticado
    ├── page.tsx
    └── compose/
        └── page.tsx
```

**Convenções obrigatórias**

- Toda rota é um diretório com `page.tsx`.
- Layouts compartilhados usam `layout.tsx` — não componentes wrapper em `page.tsx`.
- Proteção de rotas autenticadas fica no `layout.tsx` do grupo — não em cada `page.tsx`.
- `Providers.tsx` centraliza todos os context providers (QueryClient, AuthContext) no root layout.

**Stack de UI**

- TailwindCSS para estilização — sem CSS-in-JS.
- `clsx` + `tailwind-merge` para composição de classes condicionais.
- `lucide-react` para ícones.
- TanStack Query para estado de servidor no cliente.
- React Hook Form para formulários.

**Autenticação**

- `AuthContext` (em `contexts/AuthContext.tsx`) expõe o usuário Firebase Auth para componentes cliente.
- Verificação de sessão no servidor usa Firebase Admin via API route — não no cliente diretamente.

**O que não é permitido**

- Criar arquivos em `pages/` — o Pages Router está desativado.
- Importar de `next/router` — usar `next/navigation`.
- Lógica de negócio em `page.tsx` — páginas são composição de componentes.

## References

- [_local-adr-policy-001-hexagonal-architecture](../../adrs/application/002-hexagonal-architecture.md) - Frontend comunica com api via HTTP
- [_local-bdr-policy-001-ux-principles](../../bdrs/principles/001-ux-principles.md) - Princípios UX que guiam o design das páginas
