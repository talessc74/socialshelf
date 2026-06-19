'use client'

import { auth } from './firebase'
import { Platform } from '@socialshelf/domain'

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'

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

export interface ApiConnection {
  id: string
  userId: string
  brandId: string
  platform: Platform
  pairwiseId: string
  tokenRef: string
  scopes: string[]
  expiresAt: string | null
  createdAt: string
  updatedAt: string
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
  rationale: string
  audienceFitScore: number
  createdAt: string
}

export interface ApiGenerationArtifact {
  position: number
  status: 'pending' | 'generating' | 'ready' | 'failed'
  imageStoragePath: string | null
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
    artifactCount: number
    topicSuggestionId: string | null
  }
  outputs: {
    copies: Partial<Record<Platform, { text: string; charCount: number }>>
    cta: string | null
    artifacts: ApiGenerationArtifact[]
  } | null
  error: string | null
  createdAt: string
  updatedAt: string
}

export interface GenerateContentInput {
  description: string
  textContent?: string
  imageStoragePaths?: string[]
  targetPlatforms: Platform[]
  artifactCount?: number
  topicSuggestionId?: string
}

export const api = {
  async getConnections(): Promise<ApiConnection[]> {
    const data = await apiFetch<{ connections: ApiConnection[] }>('/connections')
    return data.connections
  },

  async getAuthorizeUrl(platform: 'linkedin' | 'meta' | 'x'): Promise<string> {
    const data = await apiFetch<{ url: string }>(`/oauth/${platform}/authorize`)
    return data.url
  },

  async createPost(content: PostContent[], imageStoragePaths?: string[]): Promise<ApiPost> {
    const data = await apiFetch<{ post: ApiPost }>('/posts', {
      method: 'POST',
      body: JSON.stringify({ content, imageStoragePaths }),
    })
    return data.post
  },

  async publishPost(postId: string): Promise<PublishResponse> {
    return apiFetch<PublishResponse>(`/posts/${postId}/publish`, { method: 'POST' })
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

  async getImageUrl(path: string): Promise<string> {
    const data = await apiFetch<{ url: string }>(
      `/generation-images/signed-url?path=${encodeURIComponent(path)}`,
    )
    return data.url
  },
}
