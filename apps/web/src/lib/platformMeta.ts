import { Platform } from '@socialshelf/domain'

export const PLATFORM_META = {
  [Platform.LINKEDIN]: { label: 'LinkedIn', emoji: '💼', color: 'bg-blue-600', oauth: 'linkedin' as const },
  [Platform.FACEBOOK]: { label: 'Facebook', emoji: '👥', color: 'bg-blue-500', oauth: 'meta' as const },
  [Platform.INSTAGRAM]: { label: 'Instagram', emoji: '📸', color: 'bg-pink-500', oauth: 'meta' as const },
  [Platform.TWITTER]: { label: 'X (Twitter)', emoji: '🐦', color: 'bg-black', oauth: 'x' as const },
}
