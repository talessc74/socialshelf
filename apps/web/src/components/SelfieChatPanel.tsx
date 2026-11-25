'use client'

import { useEffect, useRef, useState } from 'react'
import { useSelfie } from '../contexts/AssistantContext'
import { SELFIE_IMAGE_SRC } from './SelfieMascot'

/**
 * Painel de chat do Selfie (_local-adr-policy-045, emenda 2026-11-23 da
 * _local-bdr-policy-011) — interação por texto livre, algo que a BDR-011 original excluía
 * explicitamente. Substitui o balão de narração enquanto aberto (ver <Selfie />); o usuário
 * abre clicando no mascote e fecha pelo botão × aqui.
 *
 * Acessibilidade: `role="dialog"` com foco inicial no campo de texto, navegável por teclado
 * (Enter envia, Tab circula pelos controles), sem travar leitor de tela — mesmas exigências já
 * em vigor pra narração na BDR-011.
 */
export function SelfieChatPanel() {
  const { chat, closeChat, sendQuestion } = useSelfie()
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const list = listRef.current
    if (list && typeof list.scrollTo === 'function') {
      list.scrollTo({ top: list.scrollHeight })
    }
  }, [chat.messages, chat.sending])

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!draft.trim() || chat.sending) return
    sendQuestion(draft)
    setDraft('')
  }

  return (
    <div
      role="dialog"
      aria-label="Chat com o Selfie"
      data-testid="selfie-chat-panel"
      className="fixed bottom-4 right-4 z-40 flex h-[28rem] w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-2xl border border-accent-soft bg-card shadow-card-elev"
    >
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-card-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={SELFIE_IMAGE_SRC} alt="" aria-hidden className="h-full w-full object-cover" />
          </div>
          <span className="text-sm font-semibold text-ink">Selfie</span>
        </div>
        <button
          type="button"
          onClick={closeChat}
          aria-label="Fechar chat"
          className="rounded-md px-1.5 py-0.5 text-sm leading-none text-muted hover:text-ink focus:outline-none focus:ring-2 focus:ring-accent"
        >
          ×
        </button>
      </div>

      <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
        {chat.messages.length === 0 && (
          <p className="text-sm text-muted">
            Oi! Pode me perguntar qualquer coisa sobre como usar o SocialShelf.
          </p>
        )}
        {chat.messages.map((turn, i) => (
          <div
            key={i}
            className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
              turn.role === 'user'
                ? 'ml-auto bg-accent text-accent-ink'
                : 'mr-auto bg-card-2 text-ink'
            }`}
          >
            {turn.text}
          </div>
        ))}
        {chat.sending && (
          <div role="status" aria-live="polite" className="mr-auto max-w-[85%] rounded-2xl bg-card-2 px-3 py-2 text-sm text-muted">
            Pensando…
          </div>
        )}
        {chat.error && (
          <div role="alert" className="mr-auto max-w-[85%] rounded-2xl bg-red-50 px-3 py-2 text-sm text-red-700">
            {chat.error}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-line p-2.5">
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Digite sua pergunta…"
          maxLength={1000}
          disabled={chat.sending}
          className="flex-1 rounded-full border border-line bg-bg px-3 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={chat.sending || !draft.trim()}
          className="shrink-0 rounded-full bg-accent px-3 py-1.5 text-sm font-semibold text-accent-ink disabled:opacity-40"
        >
          Enviar
        </button>
      </form>
    </div>
  )
}
