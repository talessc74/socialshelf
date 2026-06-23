/**
 * Dev-only script: inject an X (Twitter) OAuth 2.0 token directly into
 * Secret Manager + Firestore, bypassing the OAuth flow.
 *
 * Usage:
 *   X_ACCESS_TOKEN=<token> X_REFRESH_TOKEN=<refresh> \
 *     tsx --env-file=apps/api/.env scripts/inject-x-token.ts
 */

import { createHash } from 'crypto'
import { randomUUID } from 'crypto'
import { SecretManagerServiceClient } from '@google-cloud/secret-manager'
import { initializeApp, getApps, applicationDefault } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const USER_ID = 'fuY74jufCaO1kgPz4fMgovo3qMa2'
const PLATFORM = 'twitter'
const GCP_PROJECT_ID = process.env['GCP_PROJECT_ID'] ?? process.env['FIREBASE_PROJECT_ID'] ?? ''

const accessToken = process.env['X_ACCESS_TOKEN']
const refreshToken = process.env['X_REFRESH_TOKEN']

if (!accessToken) {
  console.error('ERROR: X_ACCESS_TOKEN env var is required')
  process.exit(1)
}

if (!GCP_PROJECT_ID) {
  console.error('ERROR: GCP_PROJECT_ID or FIREBASE_PROJECT_ID env var is required')
  process.exit(1)
}

function derivePairwiseId(userId: string, platform: string): string {
  return createHash('sha256')
    .update(`${userId}:${platform}`)
    .digest('hex')
    .slice(0, 32)
}

async function storeSecret(ref: string, value: string): Promise<void> {
  const client = new SecretManagerServiceClient()
  const parent = `projects/${GCP_PROJECT_ID}`
  const secretName = `${parent}/secrets/${ref}`

  try {
    await client.createSecret({
      parent,
      secretId: ref,
      secret: { replication: { automatic: {} } },
    })
    console.log(`Created secret: ${ref}`)
  } catch {
    console.log(`Secret already exists, adding new version: ${ref}`)
  }

  await client.addSecretVersion({
    parent: secretName,
    payload: { data: Buffer.from(value, 'utf8') },
  })
}

async function main() {
  if (getApps().length === 0) {
    initializeApp({ credential: applicationDefault(), projectId: GCP_PROJECT_ID })
  }

  const db = getFirestore()
  const pairwiseId = derivePairwiseId(USER_ID, PLATFORM)
  const tokenRef = `oauth-token-${pairwiseId}`
  const expiresAt = new Date(Date.now() + 7200 * 1000) // 2h default

  const tokenPayload = JSON.stringify({
    access_token: accessToken,
    refresh_token: refreshToken ?? null,
    expires_at: expiresAt.toISOString(),
    scope: 'tweet.read tweet.write users.read offline.access',
  })

  console.log(`Storing token in Secret Manager (ref: ${tokenRef})...`)
  await storeSecret(tokenRef, tokenPayload)

  const connection = {
    id: randomUUID(),
    userId: USER_ID,
    brandId: USER_ID,
    platform: PLATFORM,
    pairwiseId,
    tokenRef,
    scopes: ['tweet.read', 'tweet.write', 'users.read', 'offline.access'],
    expiresAt: expiresAt.toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  console.log(`Saving OAuthConnection in Firestore...`)
  await db
    .collection('users')
    .doc(USER_ID)
    .collection('brands')
    .doc(USER_ID)
    .collection('oauth_connections')
    .doc(connection.pairwiseId)
    .set(connection)

  console.log('Done! X connection injected successfully.')
  console.log(`  pairwiseId: ${pairwiseId}`)
  console.log(`  tokenRef:   ${tokenRef}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
