---
name: _local-edr-policy-061-prateleira-3d-e-interruptor-de-visual
description: Implementação técnica do redesenho da entrada /dashboard sob o interruptor viewMode (decisão de negócio em _local-bdr-policy-010, seção "Atualização — Redesign da entrada /dashboard") — Context/Provider separados pra não arrastar Firebase pro grafo de import de componentes compartilhados; preferência em localStorage por usuário com allowlist de admin hardcoded (Fase 0); trapézio da capa do livro via matrix3d (não só clip-path) pra deformar a arte junto sem cortar cantos; seletor puro em page.tsx que nunca mostra o novo visual a público/SSR. Use ao mexer em ViewModeContext/Provider, lib/viewMode, ou nos componentes em components/shelf.
apply-to: apps/web — contexts/ViewModeContext.tsx, contexts/ViewModeProvider.tsx, lib/viewMode.ts, dashboard/page.tsx (seletor), dashboard/ClassicHome.tsx, dashboard/ShelfHome.tsx, components/shelf/ (ShelfScene, BookCover, FlipClock, OpenBookSheet, OpenBookAnimation)
valid-from: 2026-07-20
---

# _local-edr-policy-061: Prateleira 3D e interruptor de visual

## Context and Problem Statement

`_local-bdr-policy-010` (seção "Atualização — Redesign da entrada `/dashboard`", 2026-07-20)
decidiu a direção visual — uma prateleira 3D de livros no desktop e um flip clock retrô no
mobile, coexistindo com a home atual por trás de um interruptor por usuário (`viewMode:
'classic' | 'shelf'`), visível só para administradores enquanto não lança ao público. Essa
policy cobre a decisão de **produto**: o que muda, para quem, e o tratamento de tema.

O que faltava registrar era a camada de **engenharia**: como o interruptor é implementado sem
acoplar componentes compartilhados a auth, onde a preferência é persistida, como o gate de
admin funciona na ausência de um sistema de papéis, e a técnica usada pra renderizar os livros
com profundidade real (não um cartaz plano). Esta lacuna foi encontrada numa auditoria de
governança pedida pelo usuário (sessão de 21/07/2026) — a feature tinha 9 commits em 3 fases e
BDR, mas nenhum EDR.

## Decision Outcome

**Arquitetura de estado dividida (Context sem auth + Provider com auth), preferência em
`localStorage` por usuário, gate de admin por allowlist de e-mail, e trapézio da capa
renderizado via homografia `matrix3d` (não `clip-path` isolado) para deformar a arte junto com
a forma do livro.**

### Details

**`ViewModeContext` (hook) separado de `ViewModeProvider` (estado)**

`ViewModeContext.tsx` não importa nada de auth/Firebase — só cria o contexto e o hook
`useViewMode()`, que devolve defaults tolerantes (`canToggle: false`, visual clássico) quando
chamado fora de um `ViewModeProvider`. `ViewModeProvider.tsx`, que de fato usa `useAuth()`, fica
isolado num módulo à parte. Isso permite que componentes compartilhados como `TopNav` consumam
o hook em teste sem inicializar Firebase — o mesmo problema que `AuthContext` já causava em
outros componentes antes desta separação.

**Preferência em `localStorage`, não Firestore — decisão de MVP explícita**

`readViewMode`/`writeViewMode` gravam sob a chave `socialshelf:viewMode:{userId}` no
`localStorage` do navegador. O comentário no próprio código já registra isso como decisão
técnica do MVP, com migração futura para o documento do usuário no Firestore prevista mas não
feita — a preferência hoje não sincroniza entre dispositivos.

**Gate de admin por allowlist de e-mail hardcoded (`ADMIN_EMAILS`)**

O produto ainda não tem papéis/claims, então "usuário admin" é uma lista de e-mails fixa no
código (`isAdminEmail`). `canToggle` (se o interruptor aparece) é hoje sinônimo de `isAdmin` —
na Fase 0 do rollout, propositalmente. Quando a BDR-010 autorizar o lançamento público, essa
equivalência precisa ser revista (todo usuário passa a poder alternar, não só a allowlist).

**Trapézio da capa via `matrix3d`, não só `clip-path`**

Iteração registrada na sequência de commits do dia: a primeira versão usava `clip-path` puro
pra recortar a capa em forma de trapézio (base cheia, topo afinado ~6,5%) — mas isso cortava a
arte SVG nos cantos em vez de fazê-la acompanhar a inclinação. A versão final usa uma
homografia `matrix3d` que mapeia o retângulo da arte original no quadrilátero do trapézio,
deformando o desenho junto — a arte de cada capa (`CoverArt`) já é desenhada sabendo dessa
proporção, então preenche o trapézio sem cortes. A sombra projetada do livro fica no wrapper
não deformado, nascendo da silhueta já inclinada.

**Seletor puro em `page.tsx`, sem flash pro público**

`DashboardPage` decide entre `ShelfHome` e `ClassicHome` só quando `hydrated && canToggle &&
viewMode === 'shelf'` — no SSR e no primeiro render (antes de hidratar), `hydrated` é `false` e
a home clássica sempre aparece primeiro, mesmo pra quem tem `shelf` salvo. Isso evita qualquer
flash do visual novo pra quem ainda não deveria vê-lo (importante enquanto o rollout é
admin-only).

**`OpenBookSheet` reaproveita tema por seção, não um painel genérico**

Ao abrir um livro, o miolo (`OpenBookSheet`) troca de "papel" conforme a seção — jornal
(`THE SHELF GAZETTE`) em Notícias, blueprint em Desempenho, papel liso nas demais — mantendo a
metáfora consistente por seção em vez de um template único. O CTA sempre navega pra rota real
já existente (`section.route`); nenhuma funcionalidade é duplicada dentro da folha, só um
resumo com link pra tela completa.

**Tema claro/escuro: interruptor de parede reaproveita `ThemeContext`, mobile fica fora**

Confirma o que a BDR-010 já definia: `ShelfScene` (desktop) troca o toggle "Lanterna" por um
`WallSwitch` visual novo, mas o motor é o mesmo `useTheme()`/`ThemeContext` de sempre — não há
lógica de tema duplicada. `FlipClock` (mobile) não implementa toggle nenhum, por decisão
deliberada da BDR-010, não por lacuna de escopo.

## What this does not solve

Não resolve a reconciliação paleta quente (prateleira) vs. fria (BDR-010, home clássica) — já
registrada como decisão em aberto na própria BDR-010, pendente de convergência da Galera de
Design (Aether · Nexus · Chronos) + Herald depois de avaliar o visual em produção. Não
substitui o gate de admin por allowlist de e-mail por um sistema de papéis real — precisa
existir antes do lançamento público do modo `shelf`. Não sincroniza a preferência `viewMode`
entre dispositivos (só `localStorage`). Não adiciona tema claro/escuro ao `FlipClock` mobile,
por escopo deliberado, não descuido.

## References

- [_local-bdr-policy-010-paleta-do-logo-nova-identidade-visual](../../bdrs/product/010-paleta-logo-identidade-visual.md) - Decisão de negócio (direção visual, interruptor, tratamento de tema, reconciliação pendente) que este EDR implementa
- `apps/web/src/contexts/ViewModeContext.tsx`, `ViewModeProvider.tsx`, `lib/viewMode.ts` - Arquitetura de estado e persistência
- `apps/web/src/components/shelf/BookCover.tsx` - Técnica matrix3d do trapézio da capa
- Testes: `FlipClock.test.tsx`, `OpenBookSheet.test.tsx`, `ShelfScene.test.tsx`, `viewMode.test.tsx`, `page.selector.test.tsx`
