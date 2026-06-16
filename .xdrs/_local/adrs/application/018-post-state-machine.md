---
name: _local-adr-policy-018-post-maquina-de-estados-de-publicacao
description: Define os estados do ciclo de vida de um Post e as transições válidas. Use ao implementar criação, edição, agendamento ou publicação de posts.
apply-to: packages/domain — Post entity; apps/api — CreatePostUseCase, PublishPostUseCase
valid-from: 2026-06-16
---

# _local-adr-policy-018: Post — Máquina de Estados de Publicação

## Context and Problem Statement

Um post no SocialShelf percorre etapas distintas: criação, revisão, agendamento e publicação. Conteúdo gerado por IA tem uma rota de entrada diferente do conteúdo criado manualmente. Sem estados explícitos, o comportamento do sistema em cada etapa é implícito e difícil de testar.

Como modelar o ciclo de vida de um Post de forma que o estado seja sempre explícito, as transições sejam verificáveis e a origem do conteúdo (humano vs IA) seja distinguível?

## Decision Outcome

**Cinco estados explícitos com duas rotas de entrada e um estado terminal duplo**

```typescript
type PostStatus = 'draft' | 'ai-draft' | 'scheduled' | 'published' | 'failed'
```

### Details

**Diagrama de transições**

```
[humano]   draft ──────────────────────────────────┐
                                                    ↓
[IA]    ai-draft → (revisão humana) → draft → scheduled → published
                                                    ↓
                                                  failed
```

**Descrição dos estados**

| Estado | Descrição |
|---|---|
| `draft` | Rascunho criado pelo usuário. Editável. Pode ser agendado ou publicado imediatamente. |
| `ai-draft` | Conteúdo gerado por IA aguardando revisão humana. Não pode ser publicado diretamente. |
| `scheduled` | Post agendado para publicação futura. Não editável. |
| `published` | Publicado com sucesso em pelo menos uma plataforma. Estado terminal. |
| `failed` | Falha na publicação. Estado terminal. Erro armazenado para diagnóstico. |

**Regras de transição**

- `draft` → `scheduled`: agendamento com data futura válida
- `draft` → `published`: publicação imediata
- `ai-draft` → `draft`: revisão humana aprovada (edição ou aceite)
- `scheduled` → `published`: publicação executada pelo publisher no horário
- `scheduled` → `failed`: falha irrecuperável na publicação agendada
- `draft` → `failed`: falha irrecuperável na publicação imediata
- `published` e `failed` não têm transições de saída — são terminais

**Validação na criação**

`CreatePostUseCase` valida o limite de caracteres da plataforma antes de persistir o draft. Post que excede o limite retorna 422 — nunca chega ao estado `draft`.

## References

- [_local-bdr-policy-004-limites-de-caracteres-por-plataforma](../../bdrs/product/004-limites-de-caracteres-plataforma.md) - Limites que bloqueiam a criação do draft
- [_local-adr-policy-019-geracao-de-conteudo-maquina-de-estados](019-generation-state-machine.md) - Estado da geração de IA que alimenta ai-draft
