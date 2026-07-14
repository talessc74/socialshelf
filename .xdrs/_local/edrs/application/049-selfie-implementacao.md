---
name: _local-edr-policy-049-selfie-implementacao
description: Decisões de implementação do assistente contextual Selfie (_local-bdr-policy-011) — persistência de dispensa em localStorage, imagem oficial com fallback SVG em vez de Lottie/Rive, camada de animação "vivo" via CSS + timer de piscada, e setters de contexto idempotentes. Use ao mexer em Selfie.tsx, AssistantContext.tsx, ou ao avaliar a migração da dispensa para o backend na onda de onboarding.
apply-to: apps/web — Selfie.tsx, AssistantContext.tsx, DashboardLayout, tela de geração
valid-from: 2026-07-14
---

# _local-edr-policy-049: Selfie — Decisões de Implementação

## Context and Problem Statement

`_local-bdr-policy-011` decidiu que o Selfie seria um assistente contextual
narrando a IA em trabalho, com guardrails de gatilho (evento real, nunca
ociosidade) e dispensa permanente. A implementação do primeiro corte exigiu
decisões técnicas concretas não cobertas pela BDR — persistência de estado,
formato da arte visual e como manter o personagem "vivo" — que divergem, em
parte, tanto da BDR quanto de um handoff de design recebido depois.

## Decision Outcome

**localStorage por dispositivo (não Firestore), imagem oficial com fallback
SVG (não Lottie/Rive), e camada de animação inteiramente em CSS + um único
timer de piscada — tudo gated por um único flag de `prefers-reduced-motion`.**

### Details

**Dispensa em localStorage, não Firestore por usuário**

A BDR-011 registrou Firestore como modelo de persistência da dispensa. O
corte 1 usa `localStorage` (`socialshelf:selfie:dismissed`) porque `apps/web`
não tem cliente Firestore (`lib/firebase.ts` só inicializa `getAuth`) — toda
escrita passaria pela API REST, exigindo endpoint novo para uma feature ainda
em validação. Efeito prático: dispensa não sincroniza entre dispositivos do
mesmo usuário. Migrar para endpoint na API é o trabalho da onda de onboarding
(segunda integração do Selfie), quando o volume de dicas justificar
persistência cross-device.

**Imagem oficial (`/selfie.png`) com fallback para SVG inline, nunca
Lottie/Rive**

A BDR-011 citava "Lottie ou Rive" como forma de animação. A implementação usa
a arte PNG oficial (aprovada visualmente, fundo transparente, 410×510) via
`<img>`, com `onError` caindo para um SVG desenhado à mão — sem biblioteca de
animação nova. Motivo: o repositório já anima outros elementos (`LanternToggle`)
com SVG inline + CSS puro, sem dependência externa; introduzir Lottie/Rive só
para o Selfie quebraria esse padrão sem necessidade, já que toda a
especificação de movimento recebida (handoff de design) é expressável em
CSS transforms sobre uma imagem estática.

**Camada "vivo" inteira em CSS, com um timer de JS só para a piscada**

Flutuar, respirar e olhar em volta são `@keyframes` puros (`ss-selfie-float`,
`ss-selfie-breathe`, `ss-selfie-look`) aplicados via classe condicional — sem
JS por trás. Piscar é o único comportamento que exige estado: uma pálpebra
sobreposta (`scaleY` de 0 a 1) controlada por um hook (`useSelfieBlink`) que
agenda `setTimeout` recursivo — intervalo aleatório 2200–4800ms, ~28% de
chance de piscada dupla, replicando a cadência do protótipo do handoff de
design. O timer é limpo no unmount e nunca agendado quando `animated` é
falso, evitando qualquer disparo de estado sob `prefers-reduced-motion`.

**Um único flag `animated` gateia tudo, sem exceção por camada**

Float, respiração, olhar, piscada e partículas são todos condicionados ao
mesmo `!reduceMotion` — nenhuma camada roda parcialmente sob redução de
movimento. Rejeitou-se deliberadamente permitir a piscada isolada (é um
flicker curto, poderia parecer "inofensivo"): manter uma regra única e sem
exceções é mais simples de auditar do que justificar caso a caso quais
animações são "leves o suficiente" para sobreviver à preferência do usuário.

**Setters de `AssistantContext` são idempotentes**

`narrate`/`clearNarration` só atualizam o estado se o valor-alvo for
diferente do atual (`setNarration(prev => prev.active === ... ? prev : ...)`).
Necessário porque `stages` (array de estágios em `useGenerationProgress`) é
recalculado a cada render sem memoização; sem a idempotência, o efeito que
publica a narração re-disparava a cada render do consumidor, causando um
loop de atualização (o valor do contexto mudava de referência mesmo com
conteúdo igual, re-renderizando quem o consome, que recalculava `stages` de
novo).

## What this does not solve

Dispensa ainda não sincroniza entre dispositivos (ver acima). Piscada e
demais camadas de movimento não têm controle individual pelo usuário — é
tudo-ou-nada via preferência do sistema operacional, não uma configuração do
produto. Conteúdo de dica segue restrito a `narration.message` (estágio real
de geração); não há "modo companheiro geral" com lista de dicas e clique
para ciclar, que o handoff de design sugeriu como API — isso permanece fora
de escopo até a onda de onboarding.

## References

- [_local-bdr-policy-011-selfie-assistente-contextual](../../bdrs/product/011-selfie-assistente-contextual.md) - Decisão de produto que esta EDR implementa
- [_local-bdr-policy-006-visao-de-experiencia-de-produto](../../bdrs/product/006-visao-experiencia-produto.md) - Origem do requisito de IA visível que motiva a narração
- [_local-edr-policy-030-testes-de-componente-em-apps-web](030-testes-componente-web.md) - Padrão de teste (Vitest + Testing Library, jsdom) seguido pela suíte do Selfie
