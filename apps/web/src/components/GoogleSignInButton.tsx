'use client'

import { useEffect, useRef, useState } from 'react'
import Script from 'next/script'
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth'
import { auth } from '../lib/firebase'

interface CredentialResponse {
  credential: string
}

interface GoogleAccountsId {
  initialize: (config: { client_id: string; callback: (response: CredentialResponse) => void }) => void
  renderButton: (
    parent: HTMLElement,
    options: {
      type: 'standard'
      theme: 'outline'
      size: 'large'
      shape: 'pill'
      text: 'continue_with'
      logo_alignment: 'left'
      width: number
    },
  ) => void
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleAccountsId } }
  }
}

interface GoogleSignInButtonProps {
  onSuccess: () => void
  onError: (message: string) => void
}

export default function GoogleSignInButton({ onSuccess, onError }: GoogleSignInButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scriptLoaded, setScriptLoaded] = useState(false)

  useEffect(() => {
    if (!scriptLoaded || !containerRef.current || !window.google) return

    window.google.accounts.id.initialize({
      client_id: process.env['NEXT_PUBLIC_GOOGLE_CLIENT_ID'] as string,
      callback: (response) => {
        const credential = GoogleAuthProvider.credential(response.credential)
        signInWithCredential(auth, credential)
          .then(onSuccess)
          .catch((err) => {
            const code = err instanceof Error && 'code' in err ? String((err as { code: unknown }).code) : 'sem código'
            onError(`Não foi possível entrar com Google (${code}). Tente novamente.`)
          })
      },
    })
    window.google.accounts.id.renderButton(containerRef.current, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      shape: 'pill',
      text: 'continue_with',
      logo_alignment: 'left',
      width: 320,
    })
  }, [scriptLoaded, onSuccess, onError])

  return (
    <>
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onLoad={() => setScriptLoaded(true)} />
      <div ref={containerRef} className="flex w-full justify-center" />
    </>
  )
}
