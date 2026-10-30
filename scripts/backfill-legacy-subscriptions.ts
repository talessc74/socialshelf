/**
 * One-time backfill: create a 'legacy' Subscription doc for every existing user, so the
 * billing rollout (_local-adr-policy-0NN) never hits EnsureSubscriptionUseCase's lazy-creation
 * path cold in production for a real pre-existing user. Idempotent — safe to re-run; skips any
 * user that already has a Subscription doc.
 *
 * Mirrors EnsureSubscriptionUseCase's own legacy/free decision (earliest Brand.createdAt for
 * the user vs. the billing cutover date) so this script and the app never disagree — if
 * BILLING_CUTOVER_DATE below ever changes, update apps/api/src/use-cases/billing/
 * EnsureSubscriptionUseCase.ts (the source of truth) first, then mirror the value here.
 *
 * Usage:
 *   GCP_PROJECT_ID=<project> tsx --env-file=apps/api/.env scripts/backfill-legacy-subscriptions.ts
 *   (add --dry-run to only print what would be written, without touching Firestore)
 */

import { initializeApp, getApps, applicationDefault } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

const GCP_PROJECT_ID = process.env['GCP_PROJECT_ID'] ?? process.env['FIREBASE_PROJECT_ID'] ?? ''
const DRY_RUN = process.argv.includes('--dry-run')

// Deve bater exatamente com BILLING_CUTOVER_DATE em
// apps/api/src/use-cases/billing/EnsureSubscriptionUseCase.ts.
const BILLING_CUTOVER_DATE = new Date('2026-11-01T00:00:00Z')
const SUBSCRIPTION_DOC_ID = 'current'

if (!GCP_PROJECT_ID) {
  console.error('ERROR: GCP_PROJECT_ID or FIREBASE_PROJECT_ID env var is required')
  process.exit(1)
}

async function main() {
  if (getApps().length === 0) {
    initializeApp({ credential: applicationDefault(), projectId: GCP_PROJECT_ID })
  }
  const db = getFirestore()

  console.log('Lendo todas as marcas (collectionGroup "brands")...')
  const brandsSnapshot = await db.collectionGroup('brands').get()

  const earliestCreatedAtByUserId = new Map<string, Date>()
  for (const doc of brandsSnapshot.docs) {
    const data = doc.data()
    const userId = data['userId'] as string | undefined
    const createdAtRaw = data['createdAt']
    if (!userId || !createdAtRaw) continue
    const createdAt = createdAtRaw instanceof Timestamp ? createdAtRaw.toDate() : new Date(createdAtRaw as string)
    const current = earliestCreatedAtByUserId.get(userId)
    if (!current || createdAt < current) earliestCreatedAtByUserId.set(userId, createdAt)
  }

  console.log(`${earliestCreatedAtByUserId.size} usuário(s) com ao menos uma marca encontrados.`)

  let created = 0
  let skippedExisting = 0
  let skippedPostCutover = 0

  for (const [userId, earliestCreatedAt] of earliestCreatedAtByUserId) {
    if (earliestCreatedAt >= BILLING_CUTOVER_DATE) {
      // Usuário cadastrado depois do corte — EnsureSubscriptionUseCase já cria 'free' pra ele
      // na primeira chamada real, não precisa de backfill.
      skippedPostCutover++
      continue
    }

    const subscriptionRef = db.collection('users').doc(userId).collection('subscription').doc(SUBSCRIPTION_DOC_ID)
    const existing = await subscriptionRef.get()
    if (existing.exists) {
      skippedExisting++
      continue
    }

    const now = new Date().toISOString()
    const subscription = {
      userId,
      tier: 'legacy',
      billingCycle: null,
      status: 'active',
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      additionalProfessionalBrands: 0,
      adminOverrideUnlimited: false,
      trialEndsAt: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      createdAt: now,
      updatedAt: now,
    }

    if (DRY_RUN) {
      console.log(`[dry-run] criaria Subscription legacy para userId=${userId}`)
    } else {
      await subscriptionRef.set(subscription)
      console.log(`Subscription legacy criado para userId=${userId}`)
    }
    created++
  }

  console.log('\nResumo:')
  console.log(`  criados (ou seriam, em --dry-run): ${created}`)
  console.log(`  já tinham Subscription (pulados):  ${skippedExisting}`)
  console.log(`  pós-corte, ficam 'free' (pulados):  ${skippedPostCutover}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
