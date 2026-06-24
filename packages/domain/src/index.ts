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
  ArtifactStatus,
  GenerationArtifact,
} from './entities/GenerationRequest.js'
export type { AudienceSignal } from './entities/AudienceSignal.js'
export type { NewsItem } from './entities/NewsItem.js'
export type { VerifiedNewsItem } from './entities/VerifiedNewsItem.js'
export type { TopicSuggestion } from './entities/TopicSuggestion.js'
export type { PerformanceSuggestion, PerformanceSuggestionFeedback } from './entities/PerformanceSuggestion.js'
export {
  Platform,
  PLATFORM_CHARACTER_LIMITS,
  PLATFORM_MEDIA_SUPPORT,
  ALL_PLATFORMS,
  MAX_GENERATION_ARTIFACTS,
} from './entities/Platform.js'
export type { PlatformMediaSupport } from './entities/Platform.js'
export { TemplateStyle, ALL_TEMPLATE_STYLES } from './entities/TemplateStyle.js'
export { AspectRatio, ALL_ASPECT_RATIOS } from './entities/AspectRatio.js'

// Ports
export type { OAuthRepository } from './ports/OAuthRepository.js'
export type { PostRepository } from './ports/PostRepository.js'
export type { TokenVaultPort } from './ports/TokenVaultPort.js'
export type { PublisherPort, PublishResult } from './ports/PublisherPort.js'
export type {
  CopyGeneratorPort,
  ContentInputs,
  ArtifactPlan,
  PlatformCopies,
  PautaContext,
  CopyGenerationResult,
} from './ports/CopyGeneratorPort.js'
export type {
  ImageGeneratorPort,
  ImagePrompt,
  GeneratedImage,
  BrandTokens,
} from './ports/ImageGeneratorPort.js'
export type {
  ArtDirectorPort,
  ArtDirectionInput,
  ArtifactBrief,
  ArtifactDirection,
  ArtDirectionResult,
} from './ports/ArtDirectorPort.js'
export type { ImageStoragePort } from './ports/ImageStoragePort.js'
export type {
  TemplateRendererPort,
  TemplateRenderInput,
  RenderedTemplateImage,
} from './ports/TemplateRendererPort.js'
export type { GenerationRequestRepository } from './ports/GenerationRequestRepository.js'
export type { BrandProfileRepository } from './ports/BrandProfileRepository.js'
export type { AnalyticsReaderPort, PostMetrics } from './ports/AnalyticsReaderPort.js'
export { ContentNotFoundError } from './ports/AnalyticsReaderPort.js'
export type { AudienceSignalRepository } from './ports/AudienceSignalRepository.js'
export type { NewsSourcePort } from './ports/NewsSourcePort.js'
export type { TopicQueryPlannerPort, TopicQueryPlannerInput } from './ports/TopicQueryPlannerPort.js'
export type { TranslatorPort, TranslateInput } from './ports/TranslatorPort.js'
export type { ThumbnailFetcherPort } from './ports/ThumbnailFetcherPort.js'
export type { TopicSuggestionRepository } from './ports/TopicSuggestionRepository.js'
export type { PerformanceSuggestionRepository } from './ports/PerformanceSuggestionRepository.js'
export type { PerformanceSuggesterPort, PerformanceSuggestionDraft } from './ports/PerformanceSuggesterPort.js'
export type {
  PatternAnalyzerPort,
  PostPerformanceSummary,
  ProfileDiagnostic,
  ProfileDiagnosticChecklistItem,
  ProfileDiagnosticTheme,
  ProfileDiagnosticActionStep,
} from './ports/PatternAnalyzerPort.js'
export type { BrandDocumentExtractorPort, BrandProfileExtraction } from './ports/BrandDocumentExtractorPort.js'

// Value Objects
export { derivePairwiseId } from './value-objects/PairwiseId.js'
