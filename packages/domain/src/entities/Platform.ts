export enum Platform {
  INSTAGRAM = 'instagram',
  FACEBOOK = 'facebook',
  LINKEDIN = 'linkedin',
  TWITTER = 'twitter',
}

export const PLATFORM_CHARACTER_LIMITS: Record<Platform, number> = {
  [Platform.INSTAGRAM]: 2200,
  [Platform.FACEBOOK]: 63206,
  [Platform.LINKEDIN]: 3000,
  [Platform.TWITTER]: 280,
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
}

export const ALL_PLATFORMS = Object.values(Platform)
