'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { api, type ApiSelfieChatTurn } from '../lib/api'

/**
 * Estado de narração do assistente Selfie (ver _local-bdr-policy-011).
 * `active` liga a superfície visual; `message` é o texto do balão de fala.
 */
interface Narration {
  active: boolean
  message: string | null
}

/**
 * Estado do chat livre do Selfie (_local-adr-policy-045, emenda 2026-11-23 da
 * _local-bdr-policy-011) — independente da narração acima. Histórico vive só no cliente,
 * reenviado a cada pergunta; nada é persistido no servidor.
 */
interface SelfieChat {
  open: boolean
  messages: ApiSelfieChatTurn[]
  sending: boolean
  error: string | null
}

interface AssistantContextValue {
  narration: Narration
  narrate: (message: string) => void
  clearNarration: () => void
  /** true = usuário desligou o Selfie de vez (botão ×). Ver useSelfieDismissal. */
  selfieDismissed: boolean
  /** false até lermos localStorage no cliente — evita flash de hidratação. */
  selfieHydrated: boolean
  setSelfieDismissed: (dismissed: boolean) => void
  chat: SelfieChat
  openChat: () => void
  closeChat: () => void
  sendQuestion: (question: string) => Promise<void>
}

const AssistantContext = createContext<AssistantContextValue | null>(null)

const SELFIE_DISMISSED_KEY = 'socialshelf:selfie:dismissed'

/**
 * Provider do assistente. Fica no layout do dashboard, acima de qualquer tela.
 * O componente <Selfie /> lê o estado; as telas publicam eventos via
 * useSelfieNarration() — sem importar o componente, mantendo o gatilho
 * desacoplado da superfície, como a BDR-011 exige.
 */
export function AssistantProvider({ children }: { children: React.ReactNode }) {
  const [narration, setNarration] = useState<Narration>({ active: false, message: null })
  // Começa "desligado" até lermos localStorage no cliente, pra <Selfie /> nunca
  // piscar aparecendo e sumindo se o usuário já tinha desligado antes.
  const [selfieDismissed, setSelfieDismissedState] = useState(true)
  const [selfieHydrated, setSelfieHydrated] = useState(false)
  const [chat, setChat] = useState<SelfieChat>({ open: false, messages: [], sending: false, error: null })

  useEffect(() => {
    setSelfieDismissedState(window.localStorage.getItem(SELFIE_DISMISSED_KEY) === '1')
    setSelfieHydrated(true)
  }, [])

  // Setters idempotentes: se o estado já é o alvo, retorna a mesma referência
  // para não disparar re-render à toa. Sem isso, um consumidor que chama
  // clearNarration() a cada render entra em loop de atualização.
  const narrate = useCallback((message: string) => {
    setNarration((prev) => (prev.active && prev.message === message ? prev : { active: true, message }))
  }, [])

  const clearNarration = useCallback(() => {
    setNarration((prev) => (!prev.active && prev.message === null ? prev : { active: false, message: null }))
  }, [])

  // Exposto também pelo TopNav (ícone pra religar) — sem isso, quem desligou no
  // × não tinha como trazer o Selfie de volta a não ser limpando o localStorage
  // manualmente pelo devtools.
  const setSelfieDismissed = useCallback((dismissed: boolean) => {
    if (dismissed) window.localStorage.setItem(SELFIE_DISMISSED_KEY, '1')
    else window.localStorage.removeItem(SELFIE_DISMISSED_KEY)
    setSelfieDismissedState(dismissed)
  }, [])

  // Abrir o chat pausa a narração passiva — os dois disputariam o mesmo espaço visual do
  // balão de fala, e o usuário que acabou de abrir o chat está pedindo atenção ativa, não uma
  // dica contextual por cima.
  const openChat = useCallback(() => {
    clearNarration()
    setChat((prev) => (prev.open ? prev : { ...prev, open: true, error: null }))
  }, [clearNarration])

  const closeChat = useCallback(() => {
    setChat((prev) => (prev.open ? { ...prev, open: false } : prev))
  }, [])

  const sendQuestion = useCallback(
    async (question: string) => {
      const trimmed = question.trim()
      if (!trimmed) return

      // Histórico enviado ao backend é o que existia ANTES desta pergunta — ela já vai
      // separadamente como `question`, incluí-la aqui também duplicaria no prompt.
      const historyBeforeThisTurn = chat.messages

      setChat((prev) => ({
        ...prev,
        messages: [...prev.messages, { role: 'user', text: trimmed }],
        sending: true,
        error: null,
      }))

      try {
        const answer = await api.askSelfie(trimmed, historyBeforeThisTurn)
        setChat((prev) => ({
          ...prev,
          messages: [...prev.messages, { role: 'selfie', text: answer }],
          sending: false,
        }))
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Não consegui responder agora. Tente de novo.'
        setChat((prev) => ({ ...prev, sending: false, error: message }))
      }
    },
    [chat.messages],
  )

  const value = useMemo(
    () => ({
      narration,
      narrate,
      clearNarration,
      selfieDismissed,
      selfieHydrated,
      setSelfieDismissed,
      chat,
      openChat,
      closeChat,
      sendQuestion,
    }),
    [narration, narrate, clearNarration, selfieDismissed, selfieHydrated, setSelfieDismissed, chat, openChat, closeChat, sendQuestion],
  )

  return <AssistantContext.Provider value={value}>{children}</AssistantContext.Provider>
}

/** Leitura do estado do assistente — usado pelo componente <Selfie />. */
export function useSelfie(): AssistantContextValue {
  const ctx = useContext(AssistantContext)
  if (!ctx) throw new Error('useSelfie deve ser usado dentro de <AssistantProvider>')
  return ctx
}

/**
 * Liga/desliga o Selfie de vez (botão × dentro do balão, ícone no TopNav pra
 * religar) — usado por qualquer lugar fora do próprio componente <Selfie />
 * que precise ler ou mudar essa preferência sem puxar o estado de narração.
 */
export function useSelfieDismissal(): Pick<AssistantContextValue, 'selfieDismissed' | 'selfieHydrated' | 'setSelfieDismissed'> {
  const { selfieDismissed, selfieHydrated, setSelfieDismissed } = useSelfie()
  return { selfieDismissed, selfieHydrated, setSelfieDismissed }
}

/**
 * Escrita de narração — usado pelas telas para publicar o que a IA está fazendo,
 * sem acoplamento ao componente visual. Gatilho por evento de estado real, nunca
 * por ociosidade (BDR-011).
 */
export function useSelfieNarration(): Pick<AssistantContextValue, 'narrate' | 'clearNarration'> {
  const { narrate, clearNarration } = useSelfie()
  return { narrate, clearNarration }
}

/**
 * Narra uma mensagem assim que ela fica disponível (dado da tela terminou de
 * carregar), uma única vez por montagem — não re-narra a cada render nem
 * atualiza sozinha depois. Gatilho por evento real (a página carregou),
 * nunca por ociosidade/timer. Usado pelas telas de conteúdo (Notícias,
 * Performance, Agenda, etc.) que calculam sua própria mensagem a partir do
 * dado já carregado e não precisam do controle fino de useSelfieNarration.
 *
 * Dispensa: o botão × do Selfie desliga o assistente inteiro por dispositivo
 * (chave global já existente), não uma dica específica — o conteúdo aqui é
 * dinâmico (muda por visita), então "nunca mais mostrar esta dica" não se
 * aplica como fazia para uma dica estática de onboarding.
 */
export function useSelfieNarrateOnReady(message: string | null): void {
  const { narrate, clearNarration } = useSelfieNarration()
  const narratedRef = useRef(false)

  useEffect(() => {
    if (message && !narratedRef.current) {
      narrate(message)
      narratedRef.current = true
    }
  }, [message, narrate])

  useEffect(() => () => clearNarration(), [clearNarration])
}
