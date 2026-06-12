import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'
import { db } from '../firebase-admin.js'
import type { TokenVaultPort } from '@socialshelf/domain'

function getKey(): Buffer {
  const secret = process.env['CSRF_SECRET']
  if (!secret) throw new Error('CSRF_SECRET is required')
  return createHash('sha256').update(`token-vault:${secret}`).digest()
}

function encrypt(plaintext: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, encrypted]).toString('base64url')
}

function decrypt(ciphertext: string): string {
  const buf = Buffer.from(ciphertext, 'base64url')
  const iv = buf.subarray(0, 12)
  const tag = buf.subarray(12, 28)
  const encrypted = buf.subarray(28)
  const decipher = createDecipheriv('aes-256-gcm', getKey(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}

export class FirestoreTokenVault implements TokenVaultPort {
  async store(ref: string, token: string): Promise<void> {
    await db.collection('token_vault').doc(ref).set({
      data: encrypt(token),
      updatedAt: new Date(),
    })
  }

  async retrieve(ref: string): Promise<string> {
    const snap = await db.collection('token_vault').doc(ref).get()
    if (!snap.exists) throw new Error(`Token ${ref} not found in vault`)
    const { data } = snap.data() as { data: string }
    return decrypt(data)
  }

  async delete(ref: string): Promise<void> {
    await db.collection('token_vault').doc(ref).delete()
  }
}
