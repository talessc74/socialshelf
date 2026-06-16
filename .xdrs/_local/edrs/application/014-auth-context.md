---
name: _local-edr-policy-014-authcontext-react
description: Define o padrão de gerenciamento de estado de autenticação no frontend React. Use ao acessar o usuário autenticado em qualquer componente ou ao implementar proteção de rota.
apply-to: apps/web — contexts/AuthContext.tsx
valid-from: 2026-06-16
---

# _local-edr-policy-014: AuthContext React

## Context and Problem Statement

Firebase Auth é assíncrono — o estado do usuário não está disponível de forma síncrona no carregamento da página. Componentes que acessam o usuário diretamente do SDK em cada render criam múltiplos listeners e comportamentos inconsistentes entre renders.

Como compartilhar o estado de autenticação Firebase de forma consistente em toda a árvore de componentes?

## Decision Outcome

**`AuthContext` com `onAuthStateChanged` como único listener, expondo `user`, `loading` e `logout()`**

### Details

**Interface do contexto**

```typescript
interface AuthContextValue {
  user: FirebaseUser | null
  loading: boolean
  logout: () => Promise<void>
}
```

**Implementação**

```typescript
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser)
      setLoading(false)
    })
    return unsubscribe  // cleanup ao desmontar
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
```

**`loading: true` até o primeiro evento**

Firebase Auth pode levar alguns milissegundos para resolver o estado inicial (verificação de sessão persistida). `loading: true` durante esse período impede que componentes renderizem conteúdo protegido antes de saber se o usuário está autenticado.

**Proteção de rota**

Layouts autenticados verificam `loading` antes de redirecionar:
```typescript
if (loading) return <LoadingSpinner />
if (!user) redirect('/login')
```

**Um único listener**

`AuthProvider` é montado uma vez no root layout. Todos os componentes acessam o mesmo estado via `useAuth()` — sem listener duplicado por componente.

## References

- [_local-edr-policy-013-firebase-id-token-bearer](013-firebase-auth-bearer.md) - `auth.currentUser` fornecido por este contexto
- [_local-edr-policy-004-next-js-14-app-router](004-nextjs-app-router.md) - `AuthProvider` no root layout via Providers.tsx
