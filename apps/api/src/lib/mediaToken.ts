import { createHmac, timingSafeEqual } from 'crypto'

const getSecret = () => {
  const s = process.env['CSRF_SECRET']
  if (!s) throw new Error('CSRF_SECRET is required')
  return s
}

// Verifica o token gerado por apps/publisher/src/lib/mediaToken.ts. Mesmo segredo
// (CSRF_SECRET), mesmo formato payload.assinatura de apps/api/src/lib/csrf.ts.
export function verifyMediaToken(token: string, expectedPath: string): boolean {
  const dotIndex = token.lastIndexOf('.')
  if (dotIndex === -1) return false

  const payload = token.slice(0, dotIndex)
  const sig = token.slice(dotIndex + 1)

  const expectedSig = createHmac('sha256', getSecret()).update(payload).digest('base64url')
  const sigBuf = Buffer.from(sig, 'base64url')
  const expectedBuf = Buffer.from(expectedSig, 'base64url')

  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    return false
  }

  let parsed: { path: string; exp: number }
  try {
    parsed = JSON.parse(Buffer.from(payload, 'base64url').toString())
  } catch {
    return false
  }

  if (parsed.path !== expectedPath) return false
  if (Date.now() > parsed.exp) return false

  return true
}
