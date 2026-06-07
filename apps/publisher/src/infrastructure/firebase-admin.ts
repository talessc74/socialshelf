import { initializeApp, getApps, applicationDefault } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'

function initFirebaseAdmin() {
  if (getApps().length > 0) return

  const projectId = process.env['FIREBASE_PROJECT_ID']
  if (!projectId) throw new Error('FIREBASE_PROJECT_ID is required')

  // Em Cloud Run usa ADC automaticamente via Service Account anexada ao serviço.
  // Em desenvolvimento local usa o serviceAccountKey.json via GOOGLE_APPLICATION_CREDENTIALS.
  initializeApp({
    credential: applicationDefault(),
    projectId,
  })
}

initFirebaseAdmin()

export const db = getFirestore()
export const adminAuth = getAuth()
