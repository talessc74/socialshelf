export type WorkspacePlan = 'free' | 'pro' | 'enterprise'

export type WorkspaceRole = 'owner' | 'editor' | 'viewer'

export interface WorkspaceQuotaLimits {
  workspacesAllowed: number
  postsPerMonth: number
  teamMembersPerWorkspace: number
}

export interface WorkspaceQuotaUsage {
  workspacesCreated: number
  postsThisMonth: number
  teamMembersActive: number
}

export interface Workspace {
  id: string
  name: string
  plan: WorkspacePlan
  createdBy: string
  createdAt: Date
  updatedAt: Date

  quotaLimits: WorkspaceQuotaLimits
  quotaUsage: WorkspaceQuotaUsage
  quotaResetAt: Date // quando reseta monthly quota

  // Documentação e metadados
  description?: string
  avatar?: string // URL ou storage path
}
