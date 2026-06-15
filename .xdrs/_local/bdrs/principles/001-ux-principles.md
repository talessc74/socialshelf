---
name: _local-bdr-policy-001-ux-principles
description: Define os princípios de UX que governam o design da interface do SocialShelf. Use ao projetar novas telas, avaliar fluxos de usuário ou resolver conflitos entre estética e usabilidade.
apply-to: Toda interface de usuário e decisão de produto visível ao usuário
valid-from: 2026-06-06
---

# _local-bdr-policy-001: Princípios de UX

## Context and Problem Statement

Decisões de interface sem princípios claros levam a inconsistência, sobrecarga cognitiva e fluxos que funcionam para quem os projetou mas não para quem os usa. O SocialShelf precisa de princípios que resolvam conflitos de design de forma previsível.

Quais princípios governam todas as decisões de interface do usuário no SocialShelf?

## Decision Outcome

**Três princípios em hierarquia: Human-Centered Design → Usabilidade Empírica → Findability First**

Conflito entre princípios é resolvido pelo princípio de maior hierarquia. Conflito entre estética e usabilidade é sempre resolvido em favor da usabilidade.

### Details

**Human-Centered Design**

- Erro do usuário é sintoma de design deficiente, não falha do operador. O sistema é redesenhado para acomodar o comportamento observado.
- Toda ação possível no sistema possui affordance sinalizada por signifier claro e perceptível.
- Toda mudança de estado gera feedback imediato e inequívoco (loading, sucesso, erro).
- Fluxos são validados por observação de comportamento real — não por intuição do time.

**Usabilidade Empírica**

- Funcionalidade não validada por observação direta de usuários reais é considerada tecnicamente nula até prova empírica.
- Conflito entre inovação estética e padrão de usabilidade estabelecido é resolvido em favor do padrão.
- O sistema não exige que o usuário memorize informações entre telas — contexto relevante é sempre visível.
- Redução de carga cognitiva é critério de qualidade da interface, não diferencial opcional.

**Information Architecture — Findability First**

- Findability é o pré-requisito cardinal de utilidade: um recurso que não pode ser encontrado não pode ser usado.
- A arquitetura de informação é verificada antes de qualquer refinamento estético.
- Conflito entre redução estética e wayfinding é resolvido em favor da affordance navegacional.
- Aumento de densidade de informação requer esquemas de metadados e classificação facetada explícita.

**Hierarquia de resolução de conflitos de UX**

1. Correção lógica da interação
2. Segurança da ação (ações destrutivas exigem confirmação)
3. Feedabck e affordance (o usuário sabe o que aconteceu e o que pode fazer)
4. Findability (o usuário encontra o que precisa)
5. Ergonomia cognitiva (menor esforço para completar a tarefa)
6. Estética (apenas quando os anteriores estão satisfeitos)

## References

- [_local-bdr-policy-001-plataforma-produto](../product/001-plataforma-produto.md) - Contexto de produto que orienta decisões de UX
- [_local-edr-policy-002-nextjs-app-router](../../edrs/application/002-nextjs-app-router.md) - Implementação frontend
