import { Platform } from '@socialshelf/domain'

// 'in_review': app ainda não passou pela revisão da própria plataforma (Meta App Review /
// TikTok Audit / tier de API do X) — só quem já foi adicionado manualmente como
// tester/target user consegue conectar de verdade. O botão de conectar continua ativo
// (não bloqueia o dono do app nem os testers já cadastrados), mas o aviso evita que um
// usuário novo tente conectar sem saber que pode falhar. Atualizar para 'live' assim que
// cada plataforma aprovar o app para uso público.
export const PLATFORM_META = {
  [Platform.LINKEDIN]: { label: 'LinkedIn', emoji: '💼', color: 'bg-blue-600', oauth: 'linkedin' as const, status: 'live' as const },
  [Platform.FACEBOOK]: { label: 'Facebook', emoji: '👥', color: 'bg-blue-500', oauth: 'meta' as const, status: 'in_review' as const },
  [Platform.INSTAGRAM]: { label: 'Instagram', emoji: '📸', color: 'bg-pink-500', oauth: 'meta' as const, status: 'in_review' as const },
  [Platform.TWITTER]: { label: 'X (Twitter)', emoji: '🐦', color: 'bg-black', oauth: 'x' as const, status: 'in_review' as const },
  [Platform.TIKTOK]: { label: 'TikTok', emoji: '🎵', color: 'bg-black', oauth: 'tiktok' as const, status: 'in_review' as const },
}
