---
name: _local-edr-policy-051-topnav-cabecalho-em-duas-linhas
description: TopNav (apps/web) divide o cabeçalho em duas linhas — logo/seletor de marca e informações do usuário (e-mail, Selfie, lanterna, sair) na linha 1; navegação completa centralizada na linha 2 — em vez de uma única linha com tudo espremido. Use ao mexer em TopNav.tsx ou em qualquer mudança de estrutura do cabeçalho do dashboard.
apply-to: apps/web — TopNav.tsx e qualquer novo item adicionado ao cabeçalho do dashboard
valid-from: 2026-07-15
---

# _local-edr-policy-051: TopNav — Cabeçalho em Duas Linhas

## Context and Problem Statement

O cabeçalho do dashboard (`TopNav.tsx`) crescia em uma única linha: logo, seletor de marca, os dez itens de navegação, e-mail, ícone do Selfie, lanterna e botão de sair, todos competindo pelo mesmo espaço horizontal em telas grandes. O usuário reportou, a partir de um screenshot da tela inicial, que a linha ficava visualmente apertada com a navegação completa. Como reorganizar o cabeçalho sem perder nenhum item nem quebrar o comportamento mobile já existente?

## Decision Outcome

**Duas linhas fixas no cabeçalho desktop: identidade (linha 1) separada de navegação (linha 2).**

Linha 1 agrupa o que identifica "quem" (marca SocialShelf, marca ativa do usuário) e "quem está logado" (e-mail, Selfie, lanterna, sair) nas duas pontas, com `justify-between`. Linha 2, abaixo de uma borda (`border-t`), contém só a navegação, centralizada numa pill (`rounded-full bg-card-2`) — o mesmo estilo visual que antes disputava espaço na linha 1.

### Details

- A navegação mobile (scroll horizontal, com affordances de gradiente/chevron) não mudou de comportamento — ela já era a segunda linha nesse breakpoint (`lg:hidden`); só passou a compartilhar o mesmo container `border-t` com a versão desktop da nav, cada uma visível conforme o breakpoint (`hidden lg:flex` vs `lg:hidden`).
- O seletor de marca (`showBrandSwitcher`, só renderiza com mais de uma marca) continua na linha 1, ao lado do logo — ele identifica "qual marca", não "para onde ir", por isso fica agrupado com a identidade, não com a navegação.
- Nenhum item foi removido ou reordenado dentro de cada grupo; a mudança é estrutural (dois containers flex empilhados em vez de um único `justify-between`), não de conteúdo.
- Validado com o snapshot visual existente (`TopNav.ct.tsx`, mobile/tablet) sem precisar atualizar imagens — confirma que o layout mobile ficou pixel-idêntico. Não há snapshot de regressão para desktop (o teste único de `TopNav.ct.tsx` pula viewports ≥1024px); a checagem no breakpoint desktop foi visual manual.

## References

- [_local-bdr-policy-001-principios-de-ux](../../bdrs/principles/001-ux-principles.md) - Findability e ergonomia cognitiva: cabeçalho menos apertado reduz a competição visual entre identidade e navegação
- [_local-edr-policy-031-testes-visuais-de-regressao-em-apps-web](031-testes-visuais-regressao.md) - Padrão de snapshot (Playwright CT, 3 viewports) usado para validar que o mobile não regrediu
- PR talessc74/socialshelf#168
