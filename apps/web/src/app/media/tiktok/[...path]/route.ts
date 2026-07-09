import { NextRequest, NextResponse } from 'next/server'

// Proxy público: o TikTok busca o vídeo diretamente por esta URL via PULL_FROM_URL
// (_local-adr-policy-035), sem sessão de usuário. radiokactus.com já é um domínio
// verificado no TikTok for Developers (_local-adr-policy-039), então servir o vídeo
// aqui evita ter que verificar o domínio do bucket do Cloud Storage separadamente.
export async function GET(request: NextRequest, { params }: { params: { path: string[] } }) {
  const storagePath = params.path.join('/')

  if (!storagePath.startsWith('videos/')) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
  }

  const token = request.nextUrl.searchParams.get('token')
  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 })
  }

  const apiUrl = process.env['API_URL'] ?? 'http://localhost:3001'
  const upstream = await fetch(
    `${apiUrl}/media/tiktok-video?path=${encodeURIComponent(storagePath)}&token=${encodeURIComponent(token)}`,
  )

  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: 'Video not found' }, { status: upstream.status || 502 })
  }

  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': upstream.headers.get('content-type') ?? 'video/mp4',
      ...(upstream.headers.get('content-length')
        ? { 'Content-Length': upstream.headers.get('content-length')! }
        : {}),
    },
  })
}
