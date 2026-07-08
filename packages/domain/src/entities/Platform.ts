export enum Platform {
  INSTAGRAM = 'instagram',
  FACEBOOK = 'facebook',
  LINKEDIN = 'linkedin',
  TWITTER = 'twitter',
  TIKTOK = 'tiktok',
}

export const PLATFORM_CHARACTER_LIMITS: Record<Platform, number> = {
  [Platform.INSTAGRAM]: 2200,
  [Platform.FACEBOOK]: 63206,
  [Platform.LINKEDIN]: 3000,
  [Platform.TWITTER]: 280,
  [Platform.TIKTOK]: 2200,
}

export interface PlatformMediaSupport {
  supportsImage: boolean
  requiresImage: boolean
}

export const PLATFORM_MEDIA_SUPPORT: Record<Platform, PlatformMediaSupport> = {
  [Platform.INSTAGRAM]: { supportsImage: true, requiresImage: true },
  [Platform.FACEBOOK]: { supportsImage: true, requiresImage: false },
  [Platform.LINKEDIN]: { supportsImage: false, requiresImage: false },
  [Platform.TWITTER]: { supportsImage: false, requiresImage: false },
  [Platform.TIKTOK]: { supportsImage: false, requiresImage: false },
}

export const ALL_PLATFORMS = Object.values(Platform)

/**
 * Teto técnico de artefatos (cards/slides) por post — alinhado ao limite real
 * de carrossel do Instagram, a única plataforma que hoje publica múltiplas imagens.
 */
export const MAX_GENERATION_ARTIFACTS = 10
