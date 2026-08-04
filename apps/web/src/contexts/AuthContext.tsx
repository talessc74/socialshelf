'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import type { User } from 'firebase/auth'
import { useQueryClient } from '@tanstack/react-query'
import { auth } from '../lib/firebase'

interface AuthContextValue {
  user: User | null
  loading: boolean
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  logout: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const queryClient = useQueryClient()
  const previousUidRef = useRef<string | null>(null)
  const hasSeenFirstAuthStateRef = useRef(false)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      const newUid = u?.uid ?? null
      // Sem isso, trocar de conta Google (sair + entrar com outro login, sem passar por
      // "nenhum usuário" visível na tela) deixava o cache do React Query (staleTime 30s,
      // QueryClient único por sessão de aba em Providers.tsx) servindo dados da conta
      // anterior — o app só assumia a conta nova depois de um F5 forçando tudo a remontar.
      // Ignora a própria primeira chamada (carregamento inicial da aba) e refresh de token
      // do mesmo usuário (uid igual), só limpa quando o uid realmente muda.
      if (hasSeenFirstAuthStateRef.current && previousUidRef.current !== newUid) {
        queryClient.clear()
      }
      hasSeenFirstAuthStateRef.current = true
      previousUidRef.current = newUid
      setUser(u)
      setLoading(false)
    })
    return unsub
  }, [queryClient])

  const logout = async () => {
    await signOut(auth)
  }

  return <AuthContext.Provider value={{ user, loading, logout }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
