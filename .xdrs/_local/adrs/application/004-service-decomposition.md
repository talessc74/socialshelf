---
name: _local-adr-policy-004-decomposicao-de-servicos
description: Define a decomposição dos serviços do SocialShelf em quatro aplicações independentes. Use ao decidir onde implementar nova funcionalidade ou criar um novo serviço.
apply-to: Todos os apps do monorepo
valid-from: 2026-06-06
---

# _local-adr-policy-004: Decomposição de Serviços

## Context and Problem Statement

Um SaaS de publicação social envolve responsabilidades distintas: gerenciar autenticação OAuth, publicar conteúdo em APIs externas, gerar conteúdo via IA e servir a interface web. Acumular essas responsabilidades em um único serviço cria acoplamento, dificulta escala independente e aumenta o raio de falha.

Como decompor o sistema em serviços com responsabilidades claras e isolamento de falhas?

## Decision Outcome

**Quatro serviços independentes com responsabilidades mutuamente exclusivas**

Cada serviço tem seu próprio processo, Dockerfile, deploy no Cloud Run e service account com escopo IAM mínimo.

### Details

| Serviço | Responsabilidade | Acesso externo |
|---|---|---|
| `api` (porta 3001) | OAuth flow, gerenciamento de posts, autenticação | Sim (público) |
| `publisher` (porta 3002) | Publicação em redes sociais (X, LinkedIn, Meta) | Não (interno) |
| `generator` (porta 3003) | Geração de cópia e imagens via Vertex AI | Não (interno) |
| `web` (porta 3000) | Interface Next.js — único ponto de contato do usuário | Sim (público) |

**Regras**

- O `publisher` e o `generator` nunca recebem tráfego direto do usuário — são chamados exclusivamente pelo `api`.
- Cada serviço tem seu próprio service account com roles IAM mínimas (princípio de menor privilégio).
- Falha no `publisher` não afeta o `api` ou o `generator` — cada serviço falha de forma isolada.
- Adicionar suporte a uma nova rede social requer apenas um novo adapter em `publisher/src/infrastructure/publishers/` — sem mudança nos outros serviços.
- Comunicação entre serviços usa `INTERNAL_SECRET` via header HTTP — nunca autenticação de usuário propagada entre serviços.

**Não é permitido**
- Importar código de um app dentro de outro app diretamente. Código compartilhado vai em `packages/`.
- Adicionar lógica de publicação no `api` ou lógica OAuth no `publisher`.

## References

- [_local-adr-policy-001-hexagonal-architecture](002-hexagonal-architecture.md) - Estrutura interna de cada serviço
- [_local-edr-policy-001-cloud-run](../../edrs/infra/007-cloud-run.md) - Deploy e IAM por serviço
- [_local-adr-policy-001-zero-trust-baseline](../controls/005-zero-trust-baseline.md) - Micro-segmentação por serviço
