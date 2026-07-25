---
name: _local-edr-policy-068-guardados-para-depois
description: Estende o padrão "guardar na prateleira" (PerformanceSuggestion.shelved, Insights) para rascunhos de post em Agendados via Post.savedForLater — um rascunho aguardando aprovação sai da fila de decisão imediata e ganha seção própria "Guardados para depois", mantendo aprovar/editar/descartar disponíveis. Novo hub /dashboard/saved-for-later junta as duas listas (sugestões guardadas + rascunhos guardados) sem unificá-las num tipo de dado genérico — só agrega duas queries existentes. Link a partir da Home (ClassicHome) com badge de contagem combinada. Use ao mexer em SetPostSavedForLaterUseCase, PostRepository.findSavedForLaterByBrand, ou na página /dashboard/saved-for-later.
apply-to: apps/api — SetPostSavedForLaterUseCase, posts.routes.ts (/posts/saved-for-later, /posts/:id/save-for-later), FirestorePostRepository; apps/web — dashboard/scheduled/page.tsx, dashboard/saved-for-later/page.tsx, dashboard/ClassicHome.tsx, components/SavedForLaterCarousel.tsx; packages/domain — Post.savedForLater
valid-from: 2026-07-25
---

# _local-edr-policy-068: Guardados Para Depois

## Context and Problem Statement

Insights já tinha uma forma de adiar uma decisão: guardar uma sugestão de post "na
prateleira" (`PerformanceSuggestion.shelved`) em vez de agir na hora. O usuário pediu o
mesmo comportamento para os rascunhos aguardando aprovação em Agendados (gerados pelo
tick de autonomia do modo semi-automático) — hoje só dá pra aprovar, editar ou descartar
na hora, sem opção de "decido depois". Pediu também um ponto de entrada único na Home
que reúna as duas coisas guardadas (sugestões e rascunhos) num só lugar.

## Decision Outcome

**`Post.savedForLater: boolean` replica o padrão já validado de `shelved`, aplicado a
rascunhos; um hub `/dashboard/saved-for-later` agrega (não unifica) as duas listas
existentes; link na Home com badge de contagem combinada.**

### Details

**Post ganha savedForLater, mesmo padrão de shelved**

`Post.savedForLater: boolean` (default `false`), toggle via `SetPostSavedForLaterUseCase`
e `POST /posts/:id/save-for-later`. `PostRepository.findSavedForLaterByBrand` usa o
mesmo truque de `FirestorePerformanceSuggestionRepository.findShelvedByBrand`: single
equality `where('savedForLater', '==', true)` na subcoleção direta (não
`collectionGroup`), sem precisar de índice composto novo — o filtro adicional por
`status === 'ai-draft'` acontece em memória, não na query.

**A flag nunca é limpa explicitamente, só perde efeito**

Uma vez que o rascunho é aprovado (aprovar e publicar muda o status pra 'scheduled' ou
'published') ou descartado, ele some da lista de guardados porque
`findSavedForLaterByBrand` também filtra por `status === 'ai-draft'` — não porque
`savedForLater` foi zerado. Mesma filosofia de simplicidade do `shelved` original: o
campo é só um filtro de exibição, não um estado que precisa ser reconciliado em toda
transição.

**Guardar tira da fila de aprovação, não duplica**

Em Agendados, um rascunho com `savedForLater: true` some da seção "Aguardando sua
aprovação" e aparece só na nova seção "Guardados para depois" — aprovar, editar e
descartar continuam disponíveis ali, mais um botão "Remover dos guardados" que devolve o
rascunho pra fila principal.

**Hub agrega duas queries, não um tipo de dado unificado**

`/dashboard/saved-for-later` busca `getShelvedPerformanceSuggestions()` e
`getSavedForLaterPosts()` em paralelo e renderiza os dois lado a lado. Deliberadamente
não criou uma entidade "SavedItem" genérica cobrindo `PerformanceSuggestion` e `Post` —
são conceitos diferentes (uma é uma ideia de post, o outro é um rascunho já gerado) e
migrar o que já funciona em Insights pra caber num tipo genérico custaria mais do que
economizaria. O hub deixa as ações completas (editar imagem, reagendar) na tela de
origem — só oferece os atalhos que são uma chamada de API só (aprovar, descartar,
remover da prateleira/dos guardados, criar post a partir da sugestão).

**Badge combinado na Home, só no ClassicHome**

Novo atalho "Guardados Para Depois" em `ClassicHome.tsx` com badge somando sugestões
guardadas + rascunhos guardados. Não estendeu o `ShelfHome` (prateleira 3D,
`_local-bdr-policy-010`) — aquele modo é gated por allowlist de admin (Fase 0) e exigiria
um novo "livro" com assets visuais próprios, fora do escopo desta mudança funcional.

**Atualização 2026-07-25 — faixa/carrossel na Home, mesmo padrão do `NewsCarousel`**

O atalho estático não deixava o usuário ver o conteúdo guardado sem clicar — pedido
explícito de ter uma faixa horizontal na Home, igual à de "Notícias para pauta"
(`NewsCarousel`), pra ver os rascunhos prontos pra publicação direto ali. Novo
`SavedForLaterCarousel.tsx` (componente próprio, cards inline não compartilhados com o
hub — o hub já tem seus próprios `SavedPostCard`/`SavedSuggestionCard` com ações mais
completas; o carrossel é só uma prévia compacta, mesmo papel que `NewsCard` faz pra
notícia) busca as duas mesmas queries do hub e renderiza scroll horizontal com `snap-x`.
Convive com o atalho antigo (não substitui) — mesmo padrão de "Notícias" ter carrossel
E atalho ao mesmo tempo em `ClassicHome.tsx`. Rascunho guardado com foto mostra a
miniatura; sem foto cai num placeholder com o ícone de guardado (`Bookmark`), nunca um
quadro quebrado.

## References

- [_local-adr-policy-041-campanha-de-fotos-espinha-dorsal-fase-1](../../adrs/application/041-campanha-de-fotos-espinha-dorsal.md) - Post.imageStoragePaths e origin, campos reaproveitados na renderização do hub
- [_local-bdr-policy-010-paleta-do-logo-nova-identidade-visual](../../bdrs/product/010-paleta-logo-identidade-visual.md) - Decisão de negócio por trás do interruptor ClassicHome/ShelfHome; hub linkado só no Classic, ShelfHome fora de escopo
- [_local-edr-policy-061-prateleira-3d-e-interruptor-de-visual](061-prateleira-3d-e-interruptor-de-visual.md) - Implementação do toggle Classic/Shelf referenciado na decisão de não estender o Shelf
