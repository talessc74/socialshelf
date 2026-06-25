import { createHmac, randomBytes, timingSafeEqual } from 'crypto'

const getSecret = () => {
  const s = process.env['CSRF_SECRET']
  if (!s) throw new Error('CSRF_SECRET is required')
  return s
}

export function generateState(userId: string, brandId: string, codeVerifier?: string): string {
  const nonce = randomBytes(16).toString('hex')
  const iat = Date.now()
  const payload = Buffer.from(
    JSON.stringify({ userId, brandId, nonce, iat, ...(codeVerifier ? { codeVerifier } : {}) }),
  ).toString('base64url')
  const sig = createHmac('sha256', getSecret()).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

export function validateState(state: string): { userId: string; brandId: string; codeVerifier?: string } {
  const dotIndex = state.lastIndexOf('.')
  if (dotIndex === -1) throw new Error('Invalid state format')

  const payload = state.slice(0, dotIndex)
  const sig = state.slice(dotIndex + 1)

  const expectedSig = createHmac('sha256', getSecret()).update(payload).digest('base64url')
  const sigBuf = Buffer.from(sig, 'base64url')
  const expectedBuf = Buffer.from(expectedSig, 'base64url')

  if (
    sigBuf.length !== expectedBuf.length ||
    !timingSafeEqual(sigBuf, expectedBuf)
  ) {
    throw new Error('Invalid state signature')
  }

  const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString()) as {
    userId: string
    brandId: string
    nonce: string
    iat: number
    codeVerifier?: string
  }

  const TEN_MINUTES = 10 * 60 * 1000
  if (Date.now() - parsed.iat > TEN_MINUTES) {
    throw new Error('State expired')
  }

  const result: { userId: string; brandId: string; codeVerifier?: string } = {
    userId: parsed.userId,
    brandId: parsed.brandId,
  }
  if (parsed.codeVerifier !== undefined) result.codeVerifier = parsed.codeVerifier
  return result
}
