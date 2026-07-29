---
name: _local-edr-policy-072-pagina-de-admin-de-gastos-de-ia
description: Nova página /dashboard/admin/ai-usage mostra o gasto estimado de IA de TODAS as contas, por mês, separado em texto e imagem — só para quem está na allowlist de admin (isAdminEmail). O gate real é no backend (requireAdmin), não a UI escondida. isAdminEmail migrou de apps/web para @socialshelf/domain porque agora protege dados de verdade, não só um interruptor de visual. Use ao mexer em /admin/ai-usage, GetAdminAiUsageSummaryUseCase, requireAdmin, ou ao decidir se um novo dado sensível de todas as contas precisa do mesmo gate.
apply-to: packages/domain — value-objects/AdminAccess.ts, ports/AiUsageReaderPort.ts, ports/BrandRepository.ts (findAll); apps/api — middleware/auth.middleware.ts (requireAdmin, request.userEmail), routes/admin.routes.ts, use-cases/admin/GetAdminAiUsageSummaryUseCase.ts, infrastructure/firestore/FirestoreAiUsageReaderRepository.ts, infrastructure/firestore/FirestoreBrandRepository.ts (findAll); apps/generator — infrastructure/firestore/FirestoreAiUsageRepository.ts (campo userId); apps/web — lib/viewMode.ts, app/dashboard/admin/ai-usage/page.tsx, components/TopNav.tsx, lib/api.ts
valid-from: 2026-07-29
---

# _local-edr-policy-072: Página de admin de gastos de IA

## Context and Problem Statement

`_local-edr-policy-071` passou a medir custo estimado de IA por chamada, mas os dados só
existiam gravados no Firestore, sem tela nenhuma pra consultar. Pedido explícito do usuário:
uma página de admin mostrando o gasto de TODAS as contas lado a lado (ex.: "Eai Jurídico" vs.
conta pessoal) — não uma tela por conta, que não permitiria comparar.

O projeto já tinha um conceito de "admin" (`_local-bdr-policy-010`, Fase 0 do redesenho da
`/dashboard`): um allowlist de e-mail (`ADMIN_EMAILS`) vivendo só em `apps/web/src/lib/
viewMode.ts`, usado para mostrar/esconder o interruptor de visual clássico/prateleira. Essa
checagem nunca precisou de gate no backend porque esconder um botão de UI não é uma fronteira
de segurança — não havia dado sensível por trás. Uma tela de gastos de TODAS as contas é
diferente: esconder o link no frontend não impede outra conta autenticada de chamar a rota
diretamente e ver o gasto alheio.

## Decision Outcome

**`isAdminEmail` migrou para `@socialshelf/domain` (compartilhado), e o gate de verdade é um
`requireAdmin` no backend (`apps/api`) — a UI escondida em `apps/web` é só conveniência, nunca
a proteção em si.**

### Details

**`isAdminEmail` vira infraestrutura compartilhada, não só de UI**

Movido de `apps/web/src/lib/viewMode.ts` para `packages/domain/src/value-objects/
AdminAccess.ts` — mesma lista (`talessc@me.com`), mesma comparação case-insensitive.
`viewMode.ts` NÃO reexporta `isAdminEmail` — quem precisa dele importa direto de
`@socialshelf/domain` (`ViewModeProvider.tsx`, `dashboard/layout.tsx`). Isso não é só
estilo: `viewMode.ts` é consumido por `ViewModeContext.tsx`, que o próprio arquivo já
documentava como "não importa nada de auth/firebase" de propósito, porque o `TopNav` (e o
teste de componente visual `TopNav.ct.tsx`) consome esse hook sem precisar montar o resto
da árvore de dependências. Um re-export ali quebrou exatamente isso na prática: o job de
regressão visual (Playwright CT) nunca builda `@socialshelf/domain` antes de rodar (só
`pnpm --filter web test:visual`, sem passar pelo `dependsOn: ["^build"]` do turbo), e
qualquer módulo que `viewMode.ts` re-exportasse de fora passava a ser resolvido nesse
grafo também — quebrando `TopNav.ct.tsx` mesmo sem `isAdminEmail` ser usado ali. Corrigido
removendo o re-export; `apps/web` (esconder o link) e `apps/api` (autorizar de verdade)
continuam lendo a mesma allowlist, só que cada import direto de `@socialshelf/domain`.

**`requireAdmin`: segundo preHandler, depende de `authenticate` já ter rodado**

`auth.middleware.ts` ganhou `request.userEmail` (de `decoded.email` do token do Firebase,
gravado junto de `request.userId` dentro de `authenticate`) e um decorator `requireAdmin`
que 403 quando `isAdminEmail(request.userEmail)` é falso. Rotas de admin usam
`preHandler: [app.authenticate, app.requireAdmin]` — nessa ordem, porque `requireAdmin`
lê um campo que só `authenticate` preenche.

**Duas novas capacidades cross-account, isoladas em ports próprios**

Todo o resto do sistema é escopado por `userId`/`brandId` do token — não existia "listar
tudo, de todo mundo". Duas adições mínimas e explicitamente documentadas como admin-only:
`BrandRepository.findAll()` (`collectionGroup('brands')`) e o novo `AiUsageReaderPort.
findAll()` (`collectionGroup('ai_usage_events')`, implementado por
`FirestoreAiUsageReaderRepository` em `apps/api` — le o que `FirestoreAiUsageRepository`
do generator-service grava). Nenhum dos dois filtra por `where`/`orderBy`, então nenhum
índice composto novo é necessário além do que já existe; a agregação por marca/mês
acontece em memória em `GetAdminAiUsageSummaryUseCase`, aceitável no volume atual (feature
nova, poucas contas).

**Evento de uso ganha o campo `userId` explícito**

`FirestoreAiUsageRepository.record()` (generator-service) passou a gravar `userId` no
próprio documento, além de já estar implícito no caminho `users/{userId}/brands/{brandId}/
ai_usage_events`. Sem isso, o reader do lado do `apps/api` precisaria decompor o path do
documento pra descobrir o dono — frágil e desnecessário quando é só mais um campo.

**Custo em USD na base, R$ só na tela**

A página converte `estimatedCostUsd` pra R$ com uma taxa de câmbio fixa e aproximada
(`USD_TO_BRL_RATE`, `apps/web`), igual ao que `_local-edr-policy-071` já definiu:
guardar em USD (o que a Vertex AI realmente cobra) e só converter na exibição, nunca no
dado persistido — evita que uma tela futura precise reprocessar histórico se o câmbio
mudar de fonte.

## What this does not solve

Não cobre os outros 7 pontos de chamada de IA ainda pendentes de `_local-edr-policy-071`
(fatia 2) — a tela simplesmente mostra zero pra eles até serem instrumentados. Não tem
paginação nem cache — aceitável no volume atual, mas vai precisar revisão se o número de
eventos crescer muito antes da fatia 2 (mais volume) ou de um usuário real pagante chegar.
Não constrói a trava de gasto diária com pausa+e-mail (`_local-edr-policy-071` também deixou
isso em aberto) — esta página é só leitura/visibilidade.

## References

- [_local-edr-policy-071-mensuracao-de-uso-de-ia-fatia-1](071-mensuracao-uso-ia-fatia-1.md) - Base de mensuração que esta página consome
- `_local-bdr-policy-010` - Origem do conceito de admin por allowlist de e-mail (Fase 0 do redesenho `/dashboard`), reaproveitado aqui com gate real no backend
