export function getAllowedWebOrigins(): string[] {
  return (process.env['CORS_ORIGINS'] ?? process.env['WEB_URL'] ?? 'http://localhost:3000')
    .split(',')
    .map((url) => url.trim())
}

export function resolveWebOrigin(requestOrigin: string | undefined): string | undefined {
  if (!requestOrigin) return undefined
  return getAllowedWebOrigins().includes(requestOrigin) ? requestOrigin : undefined
}
