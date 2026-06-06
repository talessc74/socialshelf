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

export const ALL_PLATFORMS = Object.values(Platform)
