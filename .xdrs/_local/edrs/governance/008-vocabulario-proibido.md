---
name: _local-edr-policy-008-vocabulario-proibido
description: Define o vocabulário proibido em todos os artefatos do SocialShelf. Use ao revisar PRs, documentação, comentários de código, issues ou qualquer artefato de texto do projeto.
apply-to: Todo artefato de texto — código, documentação, PRs, comentários, issues, XDRS
valid-from: 2026-06-06
---

# _local-edr-policy-008: Vocabulário Proibido

## Context and Problem Statement

Certas expressões sinalizam aceitação de dívida técnica, insegurança sistêmica ou atalhos de design que conflitam com os princípios de engenharia e segurança do SocialShelf. Vocabulário normaliza comportamento — palavras proibidas são proibidas porque as práticas que descrevem são proibidas.

Quais expressões são proibidas em qualquer artefato do projeto?

## Decision Outcome

**Lista de termos proibidos com enforcement em revisão de PRs e artefatos XDRS**

Uma ocorrência de termo proibido em um artefato invalida o artefato. O artefato deve ser corrigido antes de avançar.

### Details

**Termos proibidos**

```
hack · workaround · ad-hoc · quick-fix · depois arrumamos · good enough
obfuscation · user error · blame · aesthetic-first · inviolável
solução definitiva · confiança implícita · zona segura · big design up front
manual regression · premature optimization · dados como ativo
rede confiável · usuário interno · segurança de perímetro · zero bugs
testar tudo · roteiros rígidos · clique e grave · script monolítico
infinite storage assumption · defesa estática infalível
```

**Por que cada categoria é proibida**

- `hack · workaround · ad-hoc · quick-fix · depois arrumamos · good enough` — normalizam dívida técnica intencional.
- `obfuscation` — incompatível com transparência radical.
- `user error · blame` — erro do usuário é sintoma de design deficiente, não responsabilidade do usuário.
- `aesthetic-first` — conflita com usabilidade empírica e findability first.
- `inviolável · solução definitiva` — conflitam com Evolutionary Design.
- `confiança implícita · zona segura · rede confiável · usuário interno · segurança de perímetro` — violam Zero Trust.
- `big design up front` — conflita com design incremental e reversível.
- `manual regression · clique e grave · roteiros rígidos` — conflitam com automação e anti-flakiness.
- `premature optimization` — usado para justificar código ilegível antes de evidência de gargalo.
- `dados como ativo` — dados são passivos neste sistema.
- `zero bugs · testar tudo · infinite storage assumption · defesa estática infalível` — falsas garantias.

**Enforcement**

- Revisores de PR devem bloquear merge se qualquer termo aparecer em código, comentário, commit message, título ou descrição de PR.
- Agentes IA (ARGUS e seeds) devem recusar outputs que contenham qualquer termo da lista.
- Documentos XDRS com termo proibido são inválidos e devem ser corrigidos antes do arquivamento.

## References

- [_local-adr-policy-001-engineering-principles](../../adrs/principles/001-engineering-principles.md) - Princípios que fundamentam as proibições
- [_local-adr-policy-001-zero-trust-baseline](../../adrs/controls/005-zero-trust-baseline.md) - Termos de segurança proibidos
