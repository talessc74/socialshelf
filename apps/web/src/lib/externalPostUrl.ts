import { Platform } from '@socialshelf/domain'

// Link para o post real na rede, quando dá pra construir só a partir do externalId salvo —
// sem chamada extra a nenhuma API. Nem toda plataforma permite isso:
// - X: o endpoint /i/web/status/{id} funciona sem saber o @usuário.
// - LinkedIn: o formato de permalink /feed/update/{urn}/ aceita a URN salva como externalId.
// - Facebook: o id salvo já vem como "{page-id}_{post-id}", que facebook.com/{id} resolve.
// - Instagram: o media id numérico não é o shortcode do permalink (/p/{shortcode}/) — só a
//   Graph API devolve isso, não construível aqui sem uma chamada extra.
// - TikTok: o publish é assíncrono (PULL_FROM_URL) e o externalId retornado no momento da
//   publicação não é um link pro vídeo.
export function externalPostUrl(platform: Platform, externalId: string): string | null {
  switch (platform) {
    case Platform.TWITTER:
      return `https://x.com/i/web/status/${externalId}`
    case Platform.LINKEDIN:
      return `https://www.linkedin.com/feed/update/${externalId}/`
    case Platform.FACEBOOK:
      return `https://www.facebook.com/${externalId}`
    case Platform.INSTAGRAM:
    case Platform.TIKTOK:
      return null
  }
}
