---
name: _local-edr-policy-055-orientacao-de-conta-do-instagram
description: Conectar Meta sem os pré-requisitos (nenhuma Página do Facebook, ou Página sem Instagram Business/Creator vinculado) voltava em silêncio ou como "Conectado com sucesso" sem o Instagram — deixando o usuário adivinhar o requisito. Agora a Central de Contas avisa o pré-requisito antes de conectar, e cada desfecho vira mensagem acionável. Use ao mexer no callback do Meta ou na Central de Contas.
apply-to: apps/api — meta.routes.ts (callback); apps/web — dashboard/accounts/page.tsx, dashboard/page.tsx, lib/api.ts (selectMetaPage)
valid-from: 2026-07-19
---

# _local-edr-policy-055: Orientação de conta do Instagram

## Context and Problem Statement

Publicar no Instagram pela Graph API exige, por regra da própria Meta, que a conta seja
**Business ou Creator** e esteja **vinculada a uma Página do Facebook** — um perfil pessoal não
pode ser conectado nem publicado por app. O usuário não tinha como saber disso pelo produto, e os
dois caminhos de falha do pré-requisito eram silenciosos:

1. **Conta sem nenhuma Página do Facebook** (ex.: quem só tem Instagram pessoal): o callback do
   Meta retornava `{ facebook: null, instagram: null }` e redirecionava pra `/dashboard?connected=`
   — string vazia, que a tela lê como falsy e não mostra mensagem nenhuma. O usuário clicava em
   "Conectar", voltava pra tela e **nada acontecia**, sem explicação.

2. **Página sem Instagram Business vinculado**: só o Facebook conectava (`instagram: null`), e a
   tela mostrava "Conectado com sucesso: facebook" — o Instagram sumia da mensagem, e o usuário
   lia como "conectou tudo".

Pergunta do usuário que originou a mudança: "o creator comum será informado disso? Como ele saberá
que a conta precisa ser do tipo X? Não tem como resolvermos pra ele?" A direção foi reduzir ao
máximo a fricção de contas.

## Decision Outcome

**Transformar cada desfecho silencioso em orientação acionável, e explicar o pré-requisito na
Central de Contas antes de o usuário tentar conectar.** A informação já vem da Meta no callback
(lista de Páginas e se cada uma tem `instagram_business_account`) — só não era usada.

### Details

**Aviso prévio permanente na Central de Contas**

Um bloco fixo acima da grade de plataformas explica, antes de qualquer tentativa, que o Instagram
precisa ser Business/Creator vinculado a uma Página do Facebook, com o passo pra converter a conta.
É o maior redutor de fricção: evita a descoberta tardia, e não depende de nenhum redirect.

**Desfecho "nenhuma Página" → `metaResult=no-pages`**

O callback passa a redirecionar esse caso pra `/dashboard/accounts?metaResult=no-pages` (a tela de
conexão, não o dashboard), onde uma mensagem explica que não há Página na conta e o que fazer.
Antes ia pra `/dashboard?connected=` (vazio → nenhuma mensagem).

**Desfecho "Facebook sim, Instagram não" → `metaNote=no-instagram`**

Quando `outcome.facebook && !outcome.instagram`, o redirect de sucesso ganha `&metaNote=no-instagram`
e o dashboard avisa explícito que o Instagram ficou de fora porque a Página não tem conta
Business/Creator vinculada — em vez do "Conectado: facebook" que se lia como "conectou tudo".

**Mesmo aviso no caminho do seletor de Página**

Quando o usuário administra mais de uma Página e escolhe uma pelo seletor
(`ConfirmMetaPageSelectionUseCase`), `api.selectMetaPage` passa a devolver `instagramConnected`
(derivado de `instagram != null` na resposta), e a Central de Contas dá a mesma mensagem explícita
quando a Página escolhida não tem Instagram vinculado — antes era o genérico "Facebook (e
Instagram, se vinculado)".

**Redirect de sucesso pleno inalterado**

O caso feliz (Facebook + Instagram, ou só Facebook quando essa era a intenção) segue em
`/dashboard?connected=...` como antes — só os caminhos que precisavam de explicação mudaram, pra
não tocar no comportamento já testado do sucesso.

## What this does not solve

Não converte a conta nem cria a Página pelo usuário — a conversão pra Business/Creator e o vínculo
com a Página acontecem no app do Instagram/Facebook, fora do Social Shelf; a orientação aponta o
caminho mas não automatiza esses cliques. Não detecta o caso "tem Página mas o app do Meta ainda
não passou pelo App Review" (Advanced Access das permissões de publicação) — esse é um portão do
lado da Meta, invisível ao callback, que só se manifesta como erro de publicação (agora visível via
_local-edr-policy-054).

## References

- [_local-adr-policy-024-instagram-publicacao-em-duas-etapas](../../adrs/integration/024-instagram-publicacao-duas-etapas.md) - Fluxo e requisitos da Graph API pro Instagram, incluindo a exigência de conta vinculada a Página
- [_local-edr-policy-053-selecao-de-pagina-meta-e-rotulo-da-conta](053-selecao-de-pagina-meta-e-rotulo-da-conta.md) - Seletor de Página do Meta cujo callback e tela de Central de Contas esta policy estende
- [_local-edr-policy-054-falhas-de-publicacao-visiveis](054-falhas-de-publicacao-visiveis.md) - Falhas de publicação por rede visíveis, complemento pós-conexão desta orientação pré-conexão
