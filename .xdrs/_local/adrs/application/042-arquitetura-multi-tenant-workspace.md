---
name: _local-adr-policy-042-arquitetura-multi-tenant-workspace
description: Define a transição de single-user para SaaS multi-tenant com isolamento de workspace. Use ao criar features multi-usuário, validação de acesso, ou design de dados compartilhados.
apply-to: Todos os apps e packages do monorepo
valid-from: 2026-07-11
---

# _local-adr-policy-042: Arquitetura Multi-Tenant Workspace

> **STATUS: DESCARTADA — não implementada.** Deliberação ARGUS partiu de entendimento
> incorreto do pedido do usuário: interpretou "multi-usuário" como colaboração em equipe
> (workspace compartilhado, convites, RBAC). O pedido real era usuários totalmente
> isolados entre si, sem qualquer forma de colaboração — o que já existia no sistema via
> `/users/{userId}` + Firestore rules com `isOwner()`. Todo código gerado a partir desta
> policy (entities Workspace/WorkspaceMember/AuditLog, ports, adapters Firestore,
> middleware, security rules) foi revertido. Documento mantido apenas como registro
> histórico da deliberação e da correção de rumo.

## Context and Problem Statement

SocialShelf evoluiu de um aplicativo pessoal (single-user) para uma plataforma SaaS onde múltiplos usuários pagam mensalidade para gerenciar suas marcas. Isso requer isolamento total de dados entre usuários/equipes, validação em cada operação e rastreamento de acesso.

Como estruturar dados, autenticação e autorização para garantir que um usuário nunca veja ou modifique dados de outro workspace, e para permitir que múltiplos usuários colaborem dentro de um mesmo workspace?

## Decision Outcome

**Estrutura de Workspace como célula isolada de dados + validação de acesso em cada requisição + audit trail obrigatório**

A raiz de dados muda de `/users/{userId}` para `/workspaces/{workspaceId}`. Cada workspace é uma "célula" isolada — sem confiança implícita entre células. Validação ocorre no bearer token (uid + workspaceId decodificados) e em Firestore rules como segunda camada.

### Details

#### 1. Estrutura de Dados

**Antes (single-user):**
```
/users/{userId}
  /brands/{brandId}
  /posts/{postId}
  /oauth_connections/{connectionId}
  /generation_requests/{requestId}
```

**Depois (multi-tenant):**
```
/workspaces/{workspaceId}
  /members/{userId}               ← metadata de membros (role, permissões, added_at)
  /brands/{brandId}
    /posts/{postId}
    /oauth_connections/{connectionId}
    /generation_requests/{requestId}
  /audit_logs/{logId}             ← quem fez o quê, quando, onde
  /settings                        ← plan, quota budget, created_by

/users/{userId}                   ← compatibilidade: workspace "pessoal" dele mesmo
  /workspaces/{workspaceId}       ← lista de workspaces que o user tem acesso
```

**Regra de transição:**
- Usuário existente (você) → workspace "Personal" criado automaticamente
- Dados existentes `/users/{userId}` → migrados para `/workspaces/{personal-workspace-id}`
- Queries legadas que usem `/users/{userId}` continuam funcionando via camada de compatibilidade (mas com warning de deprecação)

#### 2. Validação de Acesso (Zero Trust)

**No Bearer Token:**
```typescript
// Token descodificado contém:
{
  uid: string                      ← user ID
  workspaceId: string              ← workspace ID (validado)
  role: "owner" | "editor" | "viewer"
  iat: number
  exp: number
}
```

**Em cada requisição:**
```
1. Decodificar token → extrai uid + workspaceId
2. Firestore query: /workspaces/{workspaceId}/members/{uid}
3. Se membro NÃO existe OU role não permite ação → DENY
4. Se membro existe E role permite → prosseguir
5. Registrar ação em /workspaces/{workspaceId}/audit_logs
```

**Firestore Rules (segunda camada):**
```firestore
match /workspaces/{workspaceId} {
  function isMember(uid) {
    return exists(/databases/$(database)/documents/workspaces/$(workspaceId)/members/$(uid));
  }
  
  function hasRole(uid, requiredRole) {
    let roles = ['owner', 'editor', 'viewer'];
    let userRole = get(/databases/$(database)/documents/workspaces/$(workspaceId)/members/$(uid)).data.role;
    return roles.indexOf(userRole) <= roles.indexOf(requiredRole);
  }
  
  allow read: if isMember(request.auth.uid);
  allow write: if hasRole(request.auth.uid, 'editor');
  allow delete: if hasRole(request.auth.uid, 'owner');
}
```

#### 3. Consentimento e Convites

**Fluxo de convite:**
1. Owner de workspace X → "Convidar membro"
2. Email enviado → link único + código de verificação
3. Novo membro → aceita → criado em `/workspaces/{workspaceId}/members/{uid}`
4. Metadados registrados: `{ role, invited_by, invited_at, accepted_at }`

**Princípio de minimal disclosure:**
- Membro vê APENAS brands/posts/dados do workspace onde tem acesso
- Não há cross-workspace visibility
- Pairwise identity por workspace (SHA256 de `userId:workspaceId:platform`)

#### 4. Quotas e Compliance

**Rastreamento por workspace:**
```typescript
/workspaces/{workspaceId}/settings {
  plan: "free" | "pro" | "enterprise"
  quota_budget: {
    posts_per_month: number
    workspaces_allowed: number
    team_members_allowed: number
  }
  posts_this_month: number
  created_by: string
  created_at: timestamp
}
```

**Audit Trail Obrigatório:**
```typescript
/workspaces/{workspaceId}/audit_logs/{logId} {
  uid: string                    ← quem fez
  action: string                 ← "post.create", "member.invite", "member.remove"
  resource_id: string            ← ID do recurso afetado
  timestamp: timestamp
  metadata: object               ← dados relevantes (post status, member role, etc)
}
```

Retenção: configurável por workspace (compliance pode exigir 1-7 anos de logs).

#### 5. Migração e Compatibilidade

**Fase 1: Estrutura paralela (agora)**
- `/workspaces/{workspaceId}` existe
- `/users/{userId}` ainda funciona (compatibilidade)
- Código novo usa workspaces; código legado pode usar users com aviso de deprecação

**Fase 2: Migração gradual (próximas semanas)**
- Oferecer ao usuário: "Converter seu account para workspace"
- Dados permanecem, estrutura muda referência
- Logs de migração em audit_logs

**Fase 3: Deprecação (quando todos migraram)**
- `/users/{userId}` removido
- API v2 não suporta users; força migração para workspaces

## Rationale

**SENTINEL (Zero Trust):** Validação em bearer token + Firestore rules = defesa em profundidade.

**SOVEREIGN (Identidade):** Pairwise por workspace + consentimento explícito = minimal disclosure.

**BLAST (Data Minimization):** Coletamos apenas uid, workspace, role, ação, timestamp. Nada mais.

**BAU (Compliance):** Audit trail é mandatory; retenção configurável permite compliance por cliente.

**FLUX (Evolutionary Design):** Migração em 3 fases permite evolução sem quebra explosiva.

**SCOUT (Testabilidade):** Isolamento é testável: "User A vê dados de workspace X?" Sim. "User A vê dados de workspace Y?" Não. Testes de isolamento são unit tests puros, sem infraestrutura.

## Consequências

**Positivas:**
- Isolamento garantido por design
- Compliance pronto para multi-tenant
- Audit trail automático para todas as ações
- Escalabilidade: múltiplos workspaces sem contaminar uns aos outros

**Negativas:**
- Refatoração significativa de queries existentes
- Período de migração requer atenção (não pode quebrar dados existentes)
- Complexidade de bearer token aumenta (uid + workspaceId)

## References

- [_local-adr-policy-005-zero-trust-baseline](../controls/005-zero-trust-baseline.md) - Zero Trust como fundação de segurança
- [_local-adr-policy-007-pairwise-identity-consent](../controls/007-pairwise-identity-consent.md) - Pairwise identity aplicada por workspace
- [_local-adr-policy-002-hexagonal-architecture](./002-hexagonal-architecture.md) - Isolamento de ports para infraestrutura de workspace
- [_local-edr-policy-045-tdd-isolamento-multi-tenant](#) - Testes de isolamento TDD
