'use client'

import { auth } from './firebase'
import { Platform, TemplateStyle, AspectRatio } from '@socialshelf/domain'
import type { ProfileDiagnostic, PostStatus } from '@socialshelf/domain'

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'

let activeBrandId: string | null = null

export function setActiveBrandId(brandId: string | null): void {
  activeBrandId = brandId
}

async function getToken(): Promise<string> {
  const user = auth.currentUser
  if (!user) throw new Error('Not authenticated')
  return user.getIdToken()
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = await getToken()
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      ...(options?.body ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${token}`,
      ...(activeBrandId ? { 'X-Brand-Id': activeBrandId } : {}),
      ...options?.headers,
    },
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }))
    const b = body as { error?: string; message?: string; details?: unknown; detail?: string }
    const msg = b.message ?? (b.error && b.detail ? `${b.error}: ${b.detail}` : b.error) ?? `HTTP ${res.status}`
    throw new Error(msg)
  }

  return res.json() as Promise<T>
}

export interface ApiBrand {
  id: string
  name: string
  slug: string
  platforms: Platform[]
}

export interface ApiConnection {
  id: string
  userId: string
  brandId: string
  platform: Platform
  pairwiseId: string
  tokenRef: string
  scopes: string[]
  organizationUrn?: string | null
  expiresAt: string | null
  createdAt: string
  updatedAt: string
}

export interface LinkedInOrganization {
  urn: string
  name: string
}

export interface PostContent {
  platform: Platform
  text: string
}

export interface ApiPost {
  id: string
  userId: string
  brandId: string
  brandProfileVersion: number | null
  content: PostContent[]
  imageStoragePaths: string[]
  status: string
  externalIds: Partial<Record<Platform, string>>
  scheduledAt: string | null
  publishedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface PublishResult {
  platform: Platform
  externalId: string
  publishedAt: string
}

export interface PublishResponse {
  postId: string
  results: PublishResult[]
  failedPlatforms: Array<{ platform: Platform; reason: string }>
}

export interface ApiAudienceSignal {
  id: string
  brandId: string
  platform: Platform
  postsAnalyzed: number
  totalImpressions: number
  totalEngagements: number
  avgEngagementRate: number
  computedAt: string
}

export interface ApiTopicSuggestion {
  id: string
  brandId: string
  headline: string
  summary: string
  sourceUrl: string
  sourceDomain: string
  articleUrl: string
  rationale: string
  audienceFitScore: number
  thumbnailUrl: string | null
  publishedPlatforms: Platform[]
  createdAt: string
}

export interface ApiPerformanceSuggestion {
  id: string
  brandId: string
  headline: string
  rationale: string
  viralScore: number
  basedOnThemes: string[]
  feedback: 'helpful' | 'not_helpful' | null
  bestTimeToPost: string
  bestTimeWeekdays: number[]
  bestTimeHourStart: number
  bestTimeHourEnd: number
  shelved: boolean
  createdAt: string
}

export interface ApiGenerationArtifact {
  position: number
  status: 'pending' | 'generating' | 'ready' | 'failed'
  imageStoragePath: string | null
  backgroundImageStoragePath: string | null
  error: string | null
}

export interface ApiGenerationRequest {
  id: string
  userId: string
  brandId: string
  status: 'pending' | 'generating_copy' | 'generating_image' | 'ready' | 'failed'
  inputs: {
    description: string
    textContent: string | null
    imageStoragePaths: string[]
    targetPlatforms: Platform[]
    topicSuggestionId: string | null
    aspectRatio: AspectRatio
    style: TemplateStyle
  }
  outputs: {
    copies: Partial<Record<Platform, { text: string; charCount: number }>>
    cta: string | null
    headlines: string[] | null
    bodyTexts: string[] | null
    artifacts: ApiGenerationArtifact[]
  } | null
  error: string | null
  createdAt: string
  updatedAt: string
}

export interface ApiBrandProfile {
  id: string
  userId: string
  brandId: string
  version: number
  business: { name: string; segment: string; description: string }
  identity: { positioning: string; values: string[] }
  visual: { primaryColor: string; secondaryColor: string; typography: string; logoStoragePath: string | null }
  voice: { tone: string; allowedVocabulary: string[]; prohibitedVocabulary: string[] }
  narrative: { recurringThemes: string[] }
  operation: {
    autonomyLevel: 'manual' | 'semi-automatic' | 'automatic'
    autoPublishTopics: string[]
    blockedTopics: string[]
  }
  createdAt: string
}

export interface ApiBrandProfileExtraction {
  business?: { name?: string; segment?: string; description?: string }
  identity?: { positioning?: string; values?: string[] }
  voice?: { tone?: string; allowedVocabulary?: string[]; prohibitedVocabulary?: string[] }
  narrative?: { recurringThemes?: string[] }
}

export interface ApiPostMetrics {
  impressions: number
  likes: number
  comments: number
  shares: number
}

export interface ApiPostPerformanceEntry {
  postId: string
  platform: Platform
  text: string
  metrics: ApiPostMetrics
  score: number
  publishedAt: string
}

export interface ApiPostPerformanceError {
  platform: Platform
  postId: string
  message: string
}

export interface ApiPostsPerformanceResult {
  entries: ApiPostPerformanceEntry[]
  errors: ApiPostPerformanceError[]
}

export interface ApiProfileDiagnosticRecord {
  id: string
  brandId: string
  postsAnalyzed: number
  diagnostic: ProfileDiagnostic
  computedAt: string
}

export interface GenerateContentInput {
  description: string
  textContent?: string
  imageStoragePaths?: string[]
  targetPlatforms: Platform[]
  topicSuggestionId?: string
  style?: TemplateStyle
  aspectRatio?: AspectRatio
  includeBodyText?: boolean
}

export const api = {
  async getBrands(): Promise<ApiBrand[]> {
    const data = await apiFetch<{ brands: ApiBrand[] }>('/brands')
    return data.brands
  },

  async getConnections(): Promise<ApiConnection[]> {
    const data = await apiFetch<{ connections: ApiConnection[] }>('/connections')
    return data.connections
  },

  async getAuthorizeUrl(platform: 'linkedin' | 'meta' | 'x' | 'tiktok'): Promise<string> {
    const data = await apiFetch<{ url: string }>(`/oauth/${platform}/authorize`)
    return data.url
  },

  async getLinkedInPageAuthorizeUrl(): Promise<string> {
    const data = await apiFetch<{ url: string }>('/oauth/linkedin-page/authorize')
    return data.url
  },

  async getLinkedInPagePendingSelection(pendingId: string): Promise<LinkedInOrganization[]> {
    const data = await apiFetch<{ organizations: LinkedInOrganization[] }>(
      `/oauth/linkedin-page/pending/${pendingId}`,
    )
    return data.organizations
  },

  async selectLinkedInPage(pendingId: string, organizationUrn: string): Promise<void> {
    await apiFetch('/oauth/linkedin-page/select', {
      method: 'POST',
      body: JSON.stringify({ pendingId, organizationUrn }),
    })
  },

  async createPost(
    content: PostContent[],
    imageStoragePaths?: string[],
    scheduledAt?: Date,
    sourceArticleUrl?: string | null,
    videoStoragePath?: string | null,
    videoConsentAcceptedAt?: string | null,
  ): Promise<ApiPost> {
    const data = await apiFetch<{ post: ApiPost }>('/posts', {
      method: 'POST',
      body: JSON.stringify({
        content,
        imageStoragePaths,
        ...(scheduledAt && { scheduledAt: scheduledAt.toISOString() }),
        ...(sourceArticleUrl !== undefined && { sourceArticleUrl }),
        ...(videoStoragePath !== undefined && { videoStoragePath }),
        ...(videoConsentAcceptedAt !== undefined && { videoConsentAcceptedAt }),
      }),
    })
    return data.post
  },

  async publishPost(postId: string): Promise<PublishResponse> {
    return apiFetch<PublishResponse>(`/posts/${postId}/publish`, { method: 'POST' })
  },

  async updatePost(
    postId: string,
    content: PostContent[],
    imageStoragePaths?: string[],
    scheduledAt?: Date | null,
  ): Promise<ApiPost> {
    const data = await apiFetch<{ post: ApiPost }>(`/posts/${postId}`, {
      method: 'PUT',
      body: JSON.stringify({
        content,
        ...(imageStoragePaths !== undefined && { imageStoragePaths }),
        ...(scheduledAt !== undefined && { scheduledAt: scheduledAt ? scheduledAt.toISOString() : null }),
      }),
    })
    return data.post
  },

  async deletePost(postId: string): Promise<void> {
    await apiFetch(`/posts/${postId}`, { method: 'DELETE' })
  },

  async getPosts(status?: PostStatus): Promise<ApiPost[]> {
    const query = status ? `?status=${status}` : ''
    const data = await apiFetch<{ posts: ApiPost[] }>(`/posts${query}`)
    return data.posts
  },

  async getPost(postId: string): Promise<ApiPost> {
    const data = await apiFetch<{ post: ApiPost }>(`/posts/${postId}`)
    return data.post
  },

  async getAudienceSignal(platform: Platform): Promise<ApiAudienceSignal> {
    const data = await apiFetch<{ audienceSignal: ApiAudienceSignal }>(
      `/audience-signal?platform=${platform}`,
    )
    return data.audienceSignal
  },

  async getTopicSuggestions(): Promise<ApiTopicSuggestion[]> {
    const data = await apiFetch<{ suggestions: ApiTopicSuggestion[] }>('/pauta-suggestions')
    return data.suggestions
  },

  async searchNews(query: string): Promise<ApiTopicSuggestion[]> {
    const data = await apiFetch<{ suggestions: ApiTopicSuggestion[] }>('/pauta-search', {
      method: 'POST',
      body: JSON.stringify({ query }),
    })
    return data.suggestions
  },

  async getPerformanceSuggestions(): Promise<ApiPerformanceSuggestion[]> {
    const data = await apiFetch<{ suggestions: ApiPerformanceSuggestion[] }>('/performance-suggestions')
    return data.suggestions
  },

  async submitPerformanceSuggestionFeedback(id: string, feedback: 'helpful' | 'not_helpful'): Promise<void> {
    await apiFetch(`/performance-suggestions/${id}/feedback`, {
      method: 'POST',
      body: JSON.stringify({ feedback }),
    })
  },

  async setPerformanceSuggestionShelved(id: string, shelved: boolean): Promise<void> {
    await apiFetch(`/performance-suggestions/${id}/shelve`, {
      method: 'POST',
      body: JSON.stringify({ shelved }),
    })
  },

  async getShelvedPerformanceSuggestions(): Promise<ApiPerformanceSuggestion[]> {
    const data = await apiFetch<{ suggestions: ApiPerformanceSuggestion[] }>('/performance-suggestions/shelved')
    return data.suggestions
  },

  async getBrandProfile(): Promise<ApiBrandProfile | null> {
    const data = await apiFetch<{ brandProfile: ApiBrandProfile | null }>('/brand-profile')
    return data.brandProfile
  },

  async updateBrandProfile(profile: Omit<ApiBrandProfile, 'id' | 'userId' | 'brandId' | 'version' | 'createdAt'>): Promise<ApiBrandProfile> {
    const data = await apiFetch<{ brandProfile: ApiBrandProfile }>('/brand-profile', {
      method: 'PUT',
      body: JSON.stringify(profile),
    })
    return data.brandProfile
  },

  async uploadImage(file: File): Promise<string> {
    const token = await getToken()
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch(`${API_URL}/images/upload`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        Authorization: `Bearer ${token}`,
        ...(activeBrandId ? { 'X-Brand-Id': activeBrandId } : {}),
      },
      body: formData,
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res.statusText }))
      throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`)
    }
    const data = (await res.json()) as { path: string }
    return data.path
  },

  async uploadVideo(
    file: File,
    durationSeconds: number,
    consent: boolean,
  ): Promise<{ path: string; consentAcceptedAt: string }> {
    const token = await getToken()
    const formData = new FormData()
    formData.append('file', file)
    formData.append('durationSeconds', String(durationSeconds))
    formData.append('consent', String(consent))
    const res = await fetch(`${API_URL}/videos/upload`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        Authorization: `Bearer ${token}`,
        ...(activeBrandId ? { 'X-Brand-Id': activeBrandId } : {}),
      },
      body: formData,
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res.statusText }))
      throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`)
    }
    return res.json() as Promise<{ path: string; consentAcceptedAt: string }>
  },

  async uploadBrandDocument(file: File): Promise<ApiBrandProfileExtraction> {
    const token = await getToken()
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch(`${API_URL}/brand-profile/document`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        Authorization: `Bearer ${token}`,
        ...(activeBrandId ? { 'X-Brand-Id': activeBrandId } : {}),
      },
      body: formData,
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res.statusText }))
      throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`)
    }
    const data = (await res.json()) as { extraction: ApiBrandProfileExtraction }
    return data.extraction
  },

  async generateContent(input: GenerateContentInput): Promise<ApiGenerationRequest> {
    const data = await apiFetch<{ generationRequest: ApiGenerationRequest }>('/generation-requests', {
      method: 'POST',
      body: JSON.stringify(input),
    })
    return data.generationRequest
  },

  async getGenerationRequest(id: string): Promise<ApiGenerationRequest> {
    const data = await apiFetch<{ generationRequest: ApiGenerationRequest }>(`/generation-requests/${id}`)
    return data.generationRequest
  },

  async editArtifact(
    generationRequestId: string,
    position: number,
    instruction: string,
  ): Promise<ApiGenerationRequest> {
    const data = await apiFetch<{ generationRequest: ApiGenerationRequest }>(
      `/generation-requests/${generationRequestId}/artifacts/${position}/edit`,
      { method: 'POST', body: JSON.stringify({ instruction }) },
    )
    return data.generationRequest
  },

  async editArtifactText(
    generationRequestId: string,
    position: number,
    headline: string,
    body: string | null,
  ): Promise<ApiGenerationRequest> {
    const data = await apiFetch<{ generationRequest: ApiGenerationRequest }>(
      `/generation-requests/${generationRequestId}/artifacts/${position}/edit-text`,
      { method: 'POST', body: JSON.stringify({ headline, body }) },
    )
    return data.generationRequest
  },

  async getPostsPerformance(): Promise<ApiPostsPerformanceResult> {
    return apiFetch<ApiPostsPerformanceResult>('/posts-performance')
  },

  async getPerformanceInsights(): Promise<ProfileDiagnostic> {
    const data = await apiFetch<{ insights: ProfileDiagnostic }>('/performance-insights')
    return data.insights
  },

  async getLatestPerformanceInsights(): Promise<ApiProfileDiagnosticRecord | null> {
    const data = await apiFetch<{ record: ApiProfileDiagnosticRecord | null }>('/performance-insights/latest')
    return data.record
  },

  async getImageUrl(path: string): Promise<string> {
    const data = await apiFetch<{ url: string }>(
      `/generation-images/signed-url?path=${encodeURIComponent(path)}`,
    )
    return data.url
  },

  async renderCard(
    imageStoragePath: string,
    headline: string,
    body: string | null,
    style: TemplateStyle,
  ): Promise<string> {
    const data = await apiFetch<{ imageStoragePath: string }>('/cards/render', {
      method: 'POST',
      body: JSON.stringify({ imageStoragePath, headline, body, style }),
    })
    return data.imageStoragePath
  },
}
