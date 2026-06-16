---
name: _local-adr-policy-021-firestore-indices-compostos-por-query
description: Define a estratégia de indexação do Firestore e os índices compostos ativos. Use ao adicionar nova query composta ou ao otimizar performance de leitura.
apply-to: firestore.indexes.json
valid-from: 2026-06-16
---

# _local-adr-policy-021: Firestore — Índices Compostos por Query

## Context and Problem Statement

Firestore requer índices compostos explícitos para queries que combinam filtro e ordenação em campos diferentes. Sem índice, a query falha em produção. Criar índices reativamente (após a query falhar) introduz downtime e degrada a experiência em produção.

Como garantir que todos os índices necessários existam antes que as queries entrem em produção?

## Decision Outcome

**Índices declarados em `firestore.indexes.json` antes da query ser implementada — estratégia query-first**

### Details

**Índices ativos**

| Coleção | Campos indexados | Propósito |
|---|---|---|
| `brands/{id}/posts` | `brandId ASC`, `status ASC`, `createdAt DESC` | Listar posts por status com ordenação cronológica |
| `brands/{id}/posts` | `brandId ASC`, `scheduledAt ASC` | Listar posts agendados por data de publicação |
| `brands/{id}/generation_requests` | `brandId ASC`, `createdAt DESC` | Listar requisições de geração cronologicamente |
| `brands/{id}/oauth_connections` | `brandId ASC`, `platform ASC` | Lookup de conexão por plataforma |
| `brands/{id}/oauth_connections` | `brandId ASC`, `pairwiseId ASC` | Deduplicação por pairwiseId |
| `brands/{id}/oauth_connections` | `brandId ASC`, `id ASC` | Lookup por ID interno |

**Regra de adição de índice**

Antes de implementar qualquer query composta (filtro + ordenação ou filtro em múltiplos campos):
1. Identificar os campos da query
2. Adicionar entrada correspondente em `firestore.indexes.json`
3. Fazer deploy do índice antes do deploy do código que executa a query

**Impacto de índice ausente**

Query composta sem índice retorna erro `9 FAILED_PRECONDITION` em produção. O Firebase Console exibe um link de criação automática de índice, mas criação leva vários minutos e deixa o sistema sem resposta nesse intervalo.

**Índices de campo único**

Firestore indexa todos os campos de forma individual por padrão. Apenas índices compostos precisam ser declarados explicitamente em `firestore.indexes.json`.

## References

- [_local-adr-policy-020-firestore-hierarquia-de-sub-documentos](020-firestore-schema.md) - Hierarquia de coleções que os índices cobrem
