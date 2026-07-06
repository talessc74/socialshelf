---
name: _local-bdr-policy-005-tokens-de-identidade-visual
description: Define a paleta, tom de copy e componentes-padrão de identidade visual do SocialShelf. Use ao criar ou revisar qualquer tela, componente ou token de UI.
apply-to: Toda interface de usuário e decisão de design visual
valid-from: 2026-06-19
---

# _local-bdr-policy-005: Tokens de Identidade Visual

## Context and Problem Statement

O SocialShelf tinha apenas um token de cor (`brand`, azul-céu genérico) sem relação com nenhuma referência de produto, tom de voz ou padrão de componente. Toda tela nova era construída com Tailwind genérico, sem direção visual — o que produzia telas funcionalmente corretas mas sem identidade, validando apenas funcionalidade, nunca desejabilidade.

A decisão original desta policy (2026-06-19) adotou paleta magenta, com referência de produto "Farol" (ia.masinegocios.com.br) como inspiração direta. Desde então a paleta passou por duas trocas nunca refletidas aqui: uma fase intermediária dourada, e a paleta azul atual (referência "Antimetal"), entregue junto com a correção de `bg-brand-400`, que nunca tinha tido cor definida. Esta revisão atualiza a policy para o estado real do código.

Quais tokens de paleta, tom de copy e componentes-padrão devem governar toda interface nova ou revisada do SocialShelf?

## Decision Outcome

**Paleta accent azul + dois contextos de fundo, tom de copy conversacional em primeira pessoa, três componentes-padrão reutilizáveis (stepper numerado, painel de recomendação, badge de score/categoria)**

Token `brand.*` em `apps/web/tailwind.config.ts` usa a escala azul abaixo (referência "Antimetal"), substituindo tanto o azul-céu genérico original quanto as paletas magenta e dourada que circularam entre essa policy e a entrega atual sem nunca serem registradas.

### Details

**Paleta**

- Accent primário: azul (`brand.500 #0ea5e9`, escala 50–900), usado em todo CTA primário, ícone ativo e destaque de marca.
- Contexto "diagnóstico/onboarding": fundo escuro com gradiente orgânico (blobs), usado em momentos de primeira impressão e fluxos de configuração inicial (ex.: dial de autonomia da Fase 0, configuração de CTA da Fase 3).
- Contexto "operação diária": fundo claro com padrão sutil de pontos, cards brancos/creme com cantos arredondados grandes e sombra suave — usado no dashboard e nas telas de trabalho recorrente (geração, kanban, calendário).
- Não são dois temas (claro/escuro) intercambiáveis pelo usuário — são dois contextos fixos por tipo de tela.

**Tom de copy**

- Primeira pessoa, conversacional, nomeando o agente/assistente quando ele fala diretamente com o usuário (ex.: sugestões de pauta, recomendações de geração).
- Tom de voz não substitui sinal de erro ou estado real — por hierarquia de `_local-bdr-policy-001-principios-de-ux`, feedback inequívoco de estado tem prioridade sobre qualquer estética de copy.

**Componentes-padrão**

- **Stepper numerado**: navegação de fluxo multi-etapa (ex.: Fase 3 — Slides → Legenda → Revisão final → Publicar). Mostra etapa atual e total.
- **Painel de recomendação**: painel lateral fixo "Recomendado por [agente]" — usado em qualquer ponto onde IA sugere ação sobre conteúdo do usuário (geração, pauta, CTA), com ações explícitas de aceitar/rejeitar a sugestão.
- **Badge de score/categoria**: indicador visual compacto de métrica calculada (ex.: potencial de alcance da Fase 2, categoria de pauta) — nunca usado para dado não verificado ou não calculado (consistente com o pipeline de verificação factual da Fase 2). Mostra o valor cru da métrica; nunca apresenta fração contra um teto fixo (ex.: "x/3") quando a métrica subjacente não tem limite superior definido — isso criaria uma escala falsa.

**Hierarquia de conflito**

Aplica-se a hierarquia já definida em `_local-bdr-policy-001-principios-de-ux`: correção → segurança → feedback/affordance → findability → ergonomia cognitiva → estética. Nenhum token desta policy pode violar essa ordem.

## Riscos

- Tom conversacional em excesso pode mascarar erro real. Mitigação: estado de erro/loading nunca é comunicado só por copy — sempre acompanhado de signifier visual padrão (cor, ícone), por exigência de `_local-bdr-policy-001-principios-de-ux`.
- Dois contextos de fundo fixos (em vez de tema único) podem fragmentar a identidade se aplicados sem critério. Mitigação: contexto é definido pelo tipo de tela (diagnóstico vs. operação), não por preferência do usuário.

## References

- [_local-bdr-policy-001-principios-de-ux](../principles/001-ux-principles.md) - Hierarquia de conflito de UX que governa qualquer token visual
- [_local-bdr-plan-002-roadmap-equipe-marketing-autonoma](../product/plans/002-roadmap-equipe-marketing-autonoma.md) - Roadmap F0–F5 que os componentes-padrão (stepper, painel de recomendação, badge de score) servem diretamente
- [_local-bdr-policy-002-socialshelf-plataforma-e-produto](../product/002-plataforma-produto.md) - Definição de produto que justifica a necessidade de identidade visual própria
