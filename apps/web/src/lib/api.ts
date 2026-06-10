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
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    },
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }))
    const b = body as { error?: string; message?: string; details?: unknown }
    const msg = b.message ?? b.error ?? `HTTP ${res.status}`
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
}
