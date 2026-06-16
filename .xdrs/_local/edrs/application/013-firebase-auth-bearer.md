---
name: _local-edr-policy-013-firebase-id-token-como-bearer
description: Define o mecanismo de autenticação do frontend com o api-service via Firebase ID Token. Use ao implementar chamadas autenticadas no cliente web ou middleware de autenticação no servidor.
apply-to: apps/web — lib/api.ts; apps/api — middleware de autenticação
valid-from: 2026-06-16
---

# _local-edr-policy-013: Firebase ID Token como Bearer

## Context and Problem Statement

O frontend precisa provar identidade ao api-service em cada requisição. Sessões de cookie exigem infraestrutura de sessão stateful ou cookies seguros com CSRF. Firebase Auth já gerencia identidade no cliente — faz sentido aproveitar o token que ele emite.

Como o frontend autentica cada requisição ao api-service sem estado de sessão adicional?

## Decision Outcome

**Firebase ID Token obtido em tempo de requisição e enviado como `Authorization: Bearer`**

### Details

**Padrão no cliente (apps/web)**

```typescript
async function apiFetch(path: string, options?: RequestInit) {
  const user = auth.currentUser
  if (!user) throw new Error('unauthenticated')

  const token = await user.getIdToken()

  return fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...options?.headers,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  })
}
```

**`getIdToken()` em cada requisição**

Firebase SDK renova o token automaticamente quando necessário (validade padrão: 1 hora). Chamar `getIdToken()` antes de cada requisição garante que o token está sempre válido — sem cache manual ou lógica de refresh.

**Validação no servidor (apps/api)**

O middleware de autenticação extrai o header `Authorization`, valida o ID Token com Firebase Admin SDK e popula `request.userId` com o UID do usuário.

Token inválido ou ausente → 401. Nenhuma rota autenticada é acessível sem token válido.

**Por que não cookie de sessão**

Cookie de sessão exigiria gerenciamento de estado server-side ou cookie JWT próprio com lógica de refresh. Firebase ID Token é stateless — o api-service valida sem consultar banco.

## References

- [_local-adr-policy-005-zero-trust-baseline](../../adrs/controls/005-zero-trust-baseline.md) - Verificação explícita em cada requisição
- [_local-edr-policy-011-cors-restrito-a-web-url](011-cors-policy.md) - `credentials: include` requer CORS com origem explícita
- [_local-edr-policy-014-auth-context-react](014-auth-context.md) - AuthContext que expõe `auth.currentUser`
