---
name: _local-bdr-policy-002-socialshelf-plataforma-e-produto
description: Define o produto SocialShelf, seu público-alvo e proposta de valor. Use ao priorizar features, avaliar escopo de novas funcionalidades ou comunicar o produto para novos colaboradores.
apply-to: Todas as decisões de produto e roadmap
valid-from: 2026-06-06
---

# _local-bdr-policy-002: SocialShelf — Plataforma e Produto

## Context and Problem Statement

Decisões de engenharia sem contexto de produto geram features tecnicamente corretas mas operacionalmente irrelevantes. O time precisa de uma definição clara do que é o SocialShelf, para quem e para que serve.

O que é o SocialShelf, quem é o usuário e qual é a proposta de valor central?

## Decision Outcome

**SaaS de publicação social para pequenos criadores de conteúdo que gerenciam suas próprias redes**

O SocialShelf não é uma ferramenta para agências ou grandes equipes. É para criadores individuais ou pequenas operações que precisam de uma interface unificada para gerenciar presença em múltiplas redes sociais.

### Details

**Público-alvo**

- Pequenos criadores de conteúdo com presença em múltiplas redes.
- Operações de uma a três pessoas gerenciando uma ou mais marcas.
- Usuários que hoje alternam manualmente entre apps de cada plataforma.

**Proposta de valor**

- Conectar contas de múltiplas redes sociais via OAuth em um único lugar.
- Publicar e agendar conteúdo em múltiplas plataformas a partir de uma interface unificada.
- Gerar cópia e imagens via IA para agilizar a criação de conteúdo.
- Monitorar publicações e status em um dashboard único.

**Produto inicial — Rádio Kactus**

O primeiro cliente e parceiro de lançamento é o Rádio Kactus. As decisões de produto da Sprint 4 são orientadas para o onboarding do Rádio Kactus como caso de uso real de validação.

**Restrições de escopo**

- O SocialShelf não armazena credenciais de redes sociais (apenas tokens OAuth).
- O sistema não gerencia comunidades, DMs ou comentários — foco exclusivo em publicação.
- Features de analytics e métricas são Sprint 3 — não Sprint 1 ou 2.

## References

- [_local-bdr-policy-002-redes-sociais-suportadas](003-redes-sociais-suportadas.md) - Plataformas suportadas
- [_local-bdr-policy-001-ux-principles](../principles/001-ux-principles.md) - Princípios de UX que guiam o produto
- [_local-bdr-plan-001-roadmap-sprints](plans/001-roadmap-sprints.md) - Roadmap de execução
