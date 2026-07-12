import { initializeApp, getApps } from 'firebase/app'
import { getAuth } from 'firebase/auth'

// Diagnóstico temporário: ?authDomainDebug=default força o authDomain padrão
// do Firebase (*.firebaseapp.com) em vez do domínio customizado, para
// comparar o comportamento do login Google via redirect no Safari entre os
// dois. Nunca afeta o comportamento normal (sem o parâmetro na URL).
const authDomainDebugOverride =
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('authDomainDebug') === 'default'
    ? 'socialshelf-547da.firebaseapp.com'
    : undefined

const firebaseConfig = {
  apiKey: process.env['NEXT_PUBLIC_FIREBASE_API_KEY'] as string,
  authDomain: authDomainDebugOverride ?? (process.env['NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN'] as string),
  projectId: process.env['NEXT_PUBLIC_FIREBASE_PROJECT_ID'] as string,
  storageBucket: process.env['NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET'] as string,
  messagingSenderId: process.env['NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'] as string,
  appId: process.env['NEXT_PUBLIC_FIREBASE_APP_ID'] as string,
  measurementId: process.env['NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID'] as string,
}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]!

export const auth = getAuth(app)
export default app
