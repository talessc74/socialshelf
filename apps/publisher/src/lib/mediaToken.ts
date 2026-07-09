import { createHmac } from 'crypto'

const getSecret = () => {
  const s = process.env['CSRF_SECRET']
  if (!s) throw new Error('CSRF_SECRET is required')
  return s
}

// Token de curta duração para o proxy público de vídeo do TikTok (_local-adr-policy-035).
// Sem isso, o path do vídeo (previsível: userId/brandId/requestId-timestamp) serviria como
// acesso indefinido ao arquivo — qualquer um com o link poderia buscá-lo para sempre.
// Reaproveita CSRF_SECRET (já disponível em api e publisher) em vez de introduzir um novo
// segredo, mesmo padrão HMAC de apps/api/src/lib/csrf.ts.
const TOKEN_TTL_MS = 2 * 60 * 60 * 1000

export function signMediaPath(path: string): string {
  const exp = Date.now() + TOKEN_TTL_MS
  const payload = Buffer.from(JSON.stringify({ path, exp })).toString('base64url')
  const sig = createHmac('sha256', getSecret()).update(payload).digest('base64url')
  return `${payload}.${sig}`
}
