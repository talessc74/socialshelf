---
name: _local-edr-policy-044-ordenacao-da-lista-de-posts-agendados
description: Ordenação da lista de posts agendados/publicados em /dashboard/scheduled — mais recente primeiro por padrão, com toggle para o usuário inverter. Use ao mexer na view de lista dessa tela ou em qualquer ordenação derivada de scheduledAt/publishedAt.
apply-to: apps/web — /dashboard/scheduled
valid-from: 2026-07-11
---

# _local-edr-policy-044: Ordenação da Lista de Posts Agendados

## Context and Problem Statement

O usuário testou a view de lista de `/dashboard/scheduled` e viu os posts publicados em ordem crescente (mais antigo primeiro) — contra-intuitivo pra uma lista de atividade recente, onde o esperado é o mais novo no topo. Pediu (1) trocar o padrão para decrescente e (2) dar ao usuário uma forma de escolher entre crescente/decrescente.

## Decision Outcome

**A ordenação passa a ser feita no cliente, por `scheduledAt`/`publishedAt` (o mesmo campo já exibido em cada card), com decrescente como padrão e um botão de toggle na view de lista.**

### Details

**Ordenação no cliente, não uma mudança de query no backend**

`FirestorePostRepository.findByBrand` já ordena por `createdAt DESC` no servidor (índice composto já `READY`), mas `createdAt` é a data em que o post foi criado no sistema — não a data exibida em cada card (`scheduledAt` para agendados, `publishedAt` para publicados). Um post pode ser criado hoje e agendado pra daqui a duas semanas; ordenar por `createdAt` não corresponde ao que o usuário lê na tela. Reordenar no backend exigiria uma nova query por campo (`scheduledAt` numa coleção, `publishedAt` na mesma coleção com filtro de status diferente) — outro índice composto, outro ponto de risco depois da recente saga de índice em `CampaignPhoto`/`CampaignItem` (`_local-edr-policy-042`). Como a lista já cabe inteira em memória no cliente (mesmo raciocínio já aplicado a `CampaignPhoto.order`, `_local-edr-policy-043`), a ordenação acontece depois do fetch via `sortByWhen(posts, direction)`, reaproveitando a função `postWhen()` que já existia (usada pelo agrupamento por dia do `CalendarView`) como fonte única da data exibida.

**Toggle único para as duas seções (agendados e publicados), não dois controles**

`scheduledPosts` e `publishedPosts` são duas listas derivadas separadas (uma por `status`), mas compartilham o mesmo `sortDirection` — um único botão na view de lista alterna as duas juntas. Duas ordenações independentes para "agendados" e "publicados" não foi pedido e adicionaria um segundo controle sem necessidade real; o usuário pensa na tela como "minha atividade", não como duas listas distintas.

**Padrão decrescente, sem persistência entre sessões**

`sortDirection` é `useState<'desc' | 'asc'>('desc')` — reseta pra decrescente a cada carregamento da página. Persistir a preferência (localStorage ou perfil) não foi pedido; se o padrão já é o que o usuário quer na maioria das vezes, adicionar persistência agora seria estado extra sem necessidade comprovada.

## What this does not solve

A view de calendário (`CalendarView`) não tem noção de ordenação própria — dentro de cada dia, os posts continuam na ordem em que aparecem no array `dayPosts` (que já reflete `sortDirection`, por herdar de `calendarPosts`), mas não há um controle de ordenação visível na view de calendário em si, só na de lista.

## References

- [_local-edr-policy-042-campanha-revisao-pos-saga-do-indice](042-campanha-revisao-pos-saga-do-indice.md) - Mesmo raciocínio de evitar novo índice composto quando ordenar em memória já resolve
- [_local-edr-policy-043-campanha-curadoria-de-fotos-e-posts](043-campanha-curadoria-de-fotos-e-posts.md) - Mesmo padrão de ordenação client-side sobre uma lista que já cabe inteira em memória
