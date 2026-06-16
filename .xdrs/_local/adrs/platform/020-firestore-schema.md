---
name: _local-adr-policy-020-firestore-hierarquia-de-sub-documentos
description: Define a hierarquia de coleções e sub-documentos no Firestore. Use ao criar nova coleção, migrar dados ou escrever regras de segurança.
apply-to: Firestore — firestore.rules, firestore.indexes.json e todos os repositories
valid-from: 2026-06-16
---

# _local-adr-policy-020: Firestore — Hierarquia de Sub-documentos

## Context and Problem Statement

Firestore suporta tanto coleções raiz quanto sub-coleções aninhadas em documentos. A escolha da hierarquia define como as regras de segurança são escritas, como as queries são construídas e como a propriedade dos dados é expressa estruturalmente.

Como organizar as coleções do Firestore para que a hierarquia reflita a propriedade dos dados, facilite regras de segurança e suporte as queries necessárias?

## Decision Outcome

**Hierarquia por propriedade: dados do usuário aninhados sob `users/{userId}`, dados da marca aninhados sob `brands/{brandId}`**

### Details

**Estrutura completa**

```
users/{userId}
  ├── ai_consent/{doc}           ← consentimento do usuário para geração por IA
  ├── daily_quota/{date}         ← cotas diárias de geração (backend-only write)
  └── brands/{brandId}
        ├── oauth_connections/{pairwiseId}   ← conexões OAuth por plataforma
        ├── posts/{postId}                   ← posts criados
        └── generation_requests/{requestId}  ← requisições de geração por IA

token_vault/{tokenRef}             ← tokens OAuth criptografados (sem acesso cliente)
```

**Princípio de aninhamento**

Sub-coleção é usada quando:
1. O dado pertence ao documento pai (brands pertencem a users; posts pertencem a brands)
2. A regra de segurança do pai deve se propagar aos filhos (isOwner no userId cobre todos os sub-documentos)
3. O dado nunca é acessado sem contexto do pai

**`token_vault` como coleção raiz**

`token_vault` é exceção intencional à hierarquia — não está aninhado sob users porque:
- Acesso é exclusivamente por backend via Admin SDK (sem rules de cliente aplicáveis)
- A chave é `tokenRef` (aleatória), sem relação com userId na estrutura do documento
- Isolamento intencional: a vault não deve ser navegável por hierarquia

**Regra de adição de coleção**

Toda nova coleção deve:
1. Ter posição justificada na hierarquia (propriedade clara)
2. Ter regra explícita em `firestore.rules` antes de entrar em produção
3. Ter índices correspondentes em `firestore.indexes.json` se queries compostas forem necessárias

## References

- [_local-adr-policy-015-firestore-security-rules-implicit-deny](../controls/015-firestore-security-rules.md) - Regras de segurança derivadas desta hierarquia
- [_local-adr-policy-021-firestore-indices-compostos-por-query](021-firestore-indexes.md) - Índices compostos para queries sobre esta hierarquia
- [_local-adr-policy-017-separacao-pairwiseid-e-tokenref-oauth](../data/017-separacao-pairwiseid-tokenref-oauth.md) - pairwiseId como chave de oauth_connections
