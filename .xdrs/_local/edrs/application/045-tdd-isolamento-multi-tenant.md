---
name: _local-edr-policy-045-tdd-para-isolamento-multi-tenant
description: Define TDD obrigatória para testes de isolamento multi-tenant. Use ao implementar qualquer feature que envolva acesso a workspace, membros, ou dados compartilhados.
apply-to: Todo código de aplicação que acessa workspace ou dados de usuários
valid-from: 2026-07-11
---

# _local-edr-policy-045: TDD para Isolamento Multi-Tenant

> **STATUS: DESCARTADA — não implementada.** Depende da arquitetura de workspace
> definida em `_local-adr-policy-042`, que foi descartada por partir de entendimento
> incorreto do pedido do usuário (colaboração em equipe, não solicitada). O isolamento
> real desejado — usuários totalmente independentes, sem colaboração — já existe via
> `/users/{userId}` + Firestore rules. Documento mantido apenas como registro histórico.

## Context and Problem Statement

Isolamento de dados entre usuários/workspaces é a propriedade crítica de segurança em SaaS multi-tenant. Testes convencionais (unitários ou integrados) podem passar sem realmente verificar isolamento — é possível testar "user A vê dados do workspace X" sem testar "user A NÃO vê dados do workspace Y". Falha silenciosa.

Como garantir que testes de isolamento sejam escritos ANTES da implementação e que cubram tanto casos positivos (vê o que deve ver) quanto negativos (não vê o que não deve ver)?

## Decision Outcome

**Testes de isolamento como suite de testes obrigatória + asserções positivas E negativas**

Toda feature que toca acesso a dados de workspace deve começar com testes que:
1. Verificam que User A consegue acessar workspace X
2. Verificam que User A NÃO consegue acessar workspace Y
3. Verificam que tampering com bearer token é detectado
4. Verificam que querystring hacking não funciona

### Details

#### 1. Padrão de Teste Obrigatório

**Estrutura de arquivo:**
```
apps/api/src/use-cases/__tests__/
  workspace-isolation.test.ts      ← testes de isolamento
```

**Padrão Red-Green-Refactor:**

```typescript
// RED: teste que falha (isolamento não implementado)
describe('Workspace Isolation', () => {
  it('User A should NOT see posts from workspace Y (user B)', async () => {
    // Setup: 2 users, 2 workspaces, cada um com 1 post
    const userA = await createTestUser();
    const userB = await createTestUser();
    const workspaceA = await createTestWorkspace(userA);
    const workspaceB = await createTestWorkspace(userB);
    const postA = await createTestPost(workspaceA, 'Post A');
    const postB = await createTestPost(workspaceB, 'Post B');
    
    // Act: userA tenta listar posts (deveria ver APENAS postA)
    const token = generateBearerToken({ uid: userA.id, workspaceId: workspaceA.id });
    const response = await request(app)
      .get(`/workspaces/${workspaceA.id}/posts`)
      .set('Authorization', `Bearer ${token}`);
    
    // Assert: DEVE retornar apenas postA, NÃO postB
    expect(response.status).toBe(200);
    expect(response.body.posts).toHaveLength(1);
    expect(response.body.posts[0].id).toBe(postA.id);
    expect(response.body.posts.map(p => p.id)).not.toContain(postB.id);
  });
  
  it('User A should NOT be able to read workspace Y even with crafted workspaceId', async () => {
    // Tampering test: tenta acessar workspaceB usando bearerToken de workspaceA
    const userA = await createTestUser();
    const workspaceA = await createTestWorkspace(userA);
    const workspaceB = await createTestWorkspace(userB); // workspace do outro usuário
    
    const token = generateBearerToken({ uid: userA.id, workspaceId: workspaceA.id });
    const response = await request(app)
      .get(`/workspaces/${workspaceB.id}/posts`)  // tenta acessar workspaceB
      .set('Authorization', `Bearer ${token}`);
    
    expect(response.status).toBe(403); // FORBIDDEN
  });

  it('User A should NOT see members of workspace Y', async () => {
    const userA = await createTestUser();
    const userB = await createTestUser();
    const userC = await createTestUser();
    const workspaceA = await createTestWorkspace(userA);
    const workspaceB = await createTestWorkspace(userB);
    await addMemberToWorkspace(workspaceB, userC, 'editor');
    
    const token = generateBearerToken({ uid: userA.id, workspaceId: workspaceA.id });
    const response = await request(app)
      .get(`/workspaces/${workspaceB.id}/members`)
      .set('Authorization', `Bearer ${token}`);
    
    expect(response.status).toBe(403);
  });
});
```

#### 2. Tipos de Testes de Isolamento

| Tipo | O que testa | Quando usar |
|---|---|---|
| **Leitura de dados** | User A lê dados de workspace X (autorizado) | Toda feature que retorna dados |
| **Escrita de dados** | User A escreve dados em workspace X (autorizado) | Toda feature que cria/atualiza dados |
| **Negação de leitura** | User A tenta ler dados de workspace Y (NEGADO) | Testes de isolamento críticos |
| **Negação de escrita** | User A tenta escrever em workspace Y (NEGADO) | Testes de isolamento críticos |
| **Tampering de token** | Modificar bearer token (uid, workspaceId) → REJECT | Testes de validação |
| **Querystring hacking** | Tentar GET `/workspaces/{otherWorkspaceId}` com token de workspace diferente | Testes de autorização |
| **Permissão por role** | Viewer não consegue create; Editor consegue | Testes de RBAC |

#### 3. Checklist de Implementação

Ao implementar uma feature que toca workspace:

- [ ] Teste RED escrito (falha sem implementação)
- [ ] Teste GREEN passa (implementação funciona)
- [ ] Teste de negação escrito (User A não vê workspace Y)
- [ ] Teste de tampering escrito (modificar token → REJECT)
- [ ] Teste de RBAC escrito (se aplicável: role restringe acesso)
- [ ] Coverage ≥ 90% para camada de autorização
- [ ] Audit log verificado (ação foi registrada)

#### 4. Testes NÃO são opcionais

**Proibido:** "Vou adicionar testes depois"

**Razão:** Isolamento é verificável apenas com testes. Sem testes, você não tem prova de que isolamento funciona.

**Consequência de teste faltante:** Feature é considerada incompleta. Não faz merge sem testes de isolamento.

#### 5. Integração com CI

```yaml
# CI pipeline: rodar testes de isolamento em cada PR
pnpm test:isolation
  ├─ Run unit tests com Vitest
  ├─ Expect coverage ≥ 90%
  ├─ Fail if any isolation test is skipped (no .skip, no .todo)
  └─ Report coverage to artifacts
```

## Rationale

**SCOUT (TDD):** Teste antes da implementação garante que a implementação é testável.

**PARETO (Princípios Fundamentais):** Isolamento é o risco 20% — merece 80% de cobertura de testes.

**SENTINEL (Zero Trust):** Testes de negação (User A não vê workspace Y) são tão importantes quanto testes positivos.

**PROBE (Teste Exploratório):** Testes de tampering e hacking exploram vetores de ataque reais.

## Consequências

**Positivas:**
- Isolamento é verificável e auditável
- Regressão de segurança é detectada em CI
- Documentação de comportamento esperado está nos testes

**Negativas:**
- Mais testes = mais tempo inicial
- Setup de testes é mais complexo (2+ usuários, 2+ workspaces)

## References

- [_local-edr-policy-001-tdd-obrigatoria](../principles/001-tdd.md) - TDD como prática obrigatória
- [_local-adr-policy-042-arquitetura-multi-tenant-workspace](../../adrs/application/042-arquitetura-multi-tenant-workspace.md) - Arquitetura de isolamento
- [_local-adr-policy-005-zero-trust-baseline](../../adrs/controls/005-zero-trust-baseline.md) - Zero Trust como princípio
