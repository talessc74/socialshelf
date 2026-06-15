---
name: _local-adr-policy-001-principios-de-engenharia
description: Define os princípios de engenharia que governam todas as decisões técnicas do SocialShelf. Use ao avaliar qualquer mudança arquitetural, priorização de dívida técnica ou decisão de design de software.
apply-to: Todo o código e decisões de engenharia do projeto
valid-from: 2026-06-06
---

# _local-adr-policy-001: Princípios de Engenharia

## Context and Problem Statement

Um SaaS com múltiplos serviços, integrações externas e equipe pequena precisa de princípios claros que orientem decisões de engenharia de forma consistente — especialmente sob pressão de prazo ou escopo.

Quais princípios devem governar todas as decisões técnicas do SocialShelf?

## Decision Outcome

**Cinco princípios não negociáveis: Evolutionary Design, Responsabilidade Profissional, Legibilidade, TDD e Inversão de Dependência**

Esses princípios são coletivamente vinculantes. Nenhum pode ser suspenso isoladamente.

### Details

**Evolutionary Design**
A arquitetura do SocialShelf não é um destino fixo. Cada decisão estrutural deve ser reversível e incremental. Nenhuma mudança estrutural é permitida sem cobertura de testes automatizados prévia. Planejamento arquitetural de longo prazo não substitui a capacidade de mudar de direção com segurança.

**Responsabilidade Profissional**
Código não testado não é código entregue. Pressão de prazo não justifica entrega sem testes. A dívida técnica gerada por entregas apressadas custa mais tempo do que o tempo economizado. Toda estimativa deve incluir tempo de teste.

**Legibilidade como Critério de Qualidade**
O código-fonte é um meio de comunicação humana que também é executável por máquinas. A qualidade é medida pela compreensão humana, não pela velocidade de execução. Código que exige esforço para ser compreendido deve ser refatorado antes de receber novas funcionalidades.

**TDD como Prática**
Toda feature começa com o teste que falha. A testabilidade nativa é um requisito de design, não uma adição posterior. Ver `_local-edr-policy-001-tdd` para detalhes de implementação.

**Inversão de Dependência**
Detalhes de infraestrutura (Firebase, Cloud Run, APIs de redes sociais) não governam a política de negócio. As camadas de negócio são independentes e substituíveis. Ver `_local-adr-policy-001-hexagonal-architecture` para a implementação arquitetural deste princípio.

## References

- [_local-adr-policy-001-hexagonal-architecture](../application/002-hexagonal-architecture.md) - Implementação de inversão de dependência
- [_local-edr-policy-001-tdd](../../edrs/principles/001-tdd.md) - Detalhes de prática TDD
