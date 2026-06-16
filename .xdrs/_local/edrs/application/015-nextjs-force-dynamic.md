---
name: _local-edr-policy-015-next-js-force-dynamic-rendering
description: Define a estratégia de renderização no root layout do Next.js. Use ao avaliar SSG vs SSR ou ao adicionar nova rota que precise de dados dinâmicos.
apply-to: apps/web — app/layout.tsx
valid-from: 2026-06-16
---

# _local-edr-policy-015: Next.js force-dynamic Rendering

## Context and Problem Statement

Next.js 14 tenta fazer cache estático (SSG) de páginas sempre que possível. O SocialShelf tem dashboard autenticado com dados por usuário — cache estático produziria páginas sem dados ou dados de outro usuário em contexto compartilhado.

Como garantir que o frontend sempre renderize com dados frescos e não sirva conteúdo cacheado incorretamente?

## Decision Outcome

**`export const dynamic = 'force-dynamic'` no root layout — desabilita cache estático para toda a aplicação**

### Details

**Declaração no root layout**

```typescript
// apps/web/src/app/layout.tsx
export const dynamic = 'force-dynamic'
```

Aplicado no root layout, propaga para todas as rotas da aplicação via herança de configuração do Next.js App Router.

**Por que `force-dynamic` e não por rota**

Todas as rotas do SocialShelf são autenticadas ou dependem de estado de sessão. Aplicar no root garante consistência — sem risco de nova rota ser adicionada e acidentalmente cacheada com dados de outro usuário.

**Impacto em performance**

`force-dynamic` desabilita SSG mas não SSR. O servidor ainda renderiza no Node.js — apenas não salva o resultado em cache estático. Para o perfil de uso do SocialShelf (dashboard por usuário), a troca é adequada.

**Exceção para página de login**

A página `/login` não tem dados dinâmicos por usuário, mas herda `force-dynamic` pelo root layout. O custo é mínimo — a página é simples e o SSR dela é instantâneo.

**output: standalone**

`next.config.ts` usa `output: 'standalone'` para gerar servidor Node.js autocontido para deploy no Cloud Run. `force-dynamic` é compatível com standalone output.

## References

- [_local-edr-policy-004-next-js-14-app-router](004-nextjs-app-router.md) - Root layout como ponto de configuração
- [_local-adr-policy-022-cloud-run-configuracao-por-servico](../../adrs/platform/022-cloud-run-config.md) - web-service no Cloud Run com output standalone
