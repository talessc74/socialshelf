export type AuditAction =
  | 'post.create'
  | 'post.update'
  | 'post.delete'
  | 'post.publish'
  | 'brand.create'
  | 'brand.update'
  | 'brand.delete'
  | 'member.invite'
  | 'member.accept'
  | 'member.remove'
  | 'member.role_change'
  | 'workspace.create'
  | 'workspace.update'
  | 'workspace.settings_change'
  | 'oauth_connection.add'
  | 'oauth_connection.remove'

export interface AuditLogMetadata {
  [key: string]: unknown
}

export interface AuditLog {
  id: string
  workspaceId: string
  uid: string // quem fez a ação
  action: AuditAction
  resourceId: string // ID do recurso afetado (post, brand, member, etc)
  resourceType: string // 'post', 'brand', 'member', etc
  timestamp: Date
  metadata: AuditLogMetadata
  ipAddress?: string
  userAgent?: string
}
