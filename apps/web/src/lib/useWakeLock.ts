'use client'

import { useEffect } from 'react'

// Mantém a tela acesa enquanto `active` — no celular, Safari e outros navegadores apagam a
// tela por inatividade e derrubam a sessão/o progresso em telas que dependem de tempo em
// tela (gerar conteúdo, compor vídeo, publicar, agendar). A Screen Wake Lock API não existe
// em todo navegador (ex: Safari só a partir do iOS 16.4) — sem suporte, é um no-op
// silencioso, não um erro. O navegador também libera o lock sozinho quando a aba fica em
// background (troca de app, por exemplo); ao voltar a ficar visível com `active` ainda
// verdadeiro, o lock é pedido de novo.
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return

    let lock: WakeLockSentinel | null = null
    let cancelled = false

    const acquire = async () => {
      try {
        const sentinel = await navigator.wakeLock.request('screen')
        if (cancelled) {
          await sentinel.release()
          return
        }
        lock = sentinel
      } catch {
        // Falha ao adquirir (ex: bateria fraca) não deve travar a ação — segue sem o lock.
      }
    }

    void acquire()

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !lock) {
        void acquire()
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibilityChange)
      if (lock) void lock.release()
    }
  }, [active])
}
