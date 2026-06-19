// Entities
export type { User, AiConsent } from './entities/User.js'
export type { Brand } from './entities/Brand.js'
export type { OAuthConnection } from './entities/OAuthConnection.js'
export type { Post, PostStatus, PlatformContent } from './entities/Post.js'
export type {
  BrandProfile,
  BrandProfileBusiness,
  BrandProfileIdentity,
  BrandProfileVisual,
  BrandProfileVoice,
  BrandProfileNarrative,
  BrandProfileOperation,
  AutonomyLevel,
} from './entities/BrandProfile.js'
export type {
  GenerationRequest,
  GenerationStatus,
  PlatformCopy,
} from './entities/GenerationRequest.js'
export { Platform, PLATFORM_CHARACTER_LIMITS, ALL_PLATFORMS } from './entities/Platform.js'

// Ports
export type { OAuthRepository } from './ports/OAuthRepository.js'
export type { PostRepository } from './ports/PostRepository.js'
export type { TokenVaultPort } from './ports/TokenVaultPort.js'
export type { PublisherPort, PublishResult } from './ports/PublisherPort.js'
export type {
  CopyGeneratorPort,
  ContentInputs,
  PlatformCopies,
} from './ports/CopyGeneratorPort.js'
export type {
  ImageGeneratorPort,
  ImagePrompt,
  GeneratedImage,
} from './ports/ImageGeneratorPort.js'
export type { ImageStoragePort } from './ports/ImageStoragePort.js'
export type { GenerationRequestRepository } from './ports/GenerationRequestRepository.js'
export type { BrandProfileRepository } from './ports/BrandProfileRepository.js'

// Value Objects
export { derivePairwiseId } from './value-objects/PairwiseId.js'
