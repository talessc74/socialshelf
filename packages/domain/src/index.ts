// Entities
export type { User, AiConsent } from './entities/User'
export type { Brand } from './entities/Brand'
export type { OAuthConnection } from './entities/OAuthConnection'
export type { Post, PostStatus, PlatformContent } from './entities/Post'
export type {
  GenerationRequest,
  GenerationStatus,
  PlatformCopy,
} from './entities/GenerationRequest'
export { Platform, PLATFORM_CHARACTER_LIMITS, ALL_PLATFORMS } from './entities/Platform'

// Ports
export type { OAuthRepository } from './ports/OAuthRepository'
export type { PostRepository } from './ports/PostRepository'
export type { TokenVaultPort } from './ports/TokenVaultPort'
export type { PublisherPort, PublishResult } from './ports/PublisherPort'
export type {
  CopyGeneratorPort,
  ContentInputs,
  PlatformCopies,
} from './ports/CopyGeneratorPort'
export type {
  ImageGeneratorPort,
  ImagePrompt,
  GeneratedImage,
} from './ports/ImageGeneratorPort'
export type { ImageStoragePort } from './ports/ImageStoragePort'
export type { GenerationRequestRepository } from './ports/GenerationRequestRepository'

// Value Objects
export { derivePairwiseId } from './value-objects/PairwiseId'
