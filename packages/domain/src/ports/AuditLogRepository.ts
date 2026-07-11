import type { AuditLog, AuditAction, AuditLogMetadata } from '../entities/AuditLog.js'

export interface LogAuditEventInput {
  workspaceId: string
  uid: string
  action: AuditAction
  resourceId: string
  resourceType: string
  metadata: AuditLogMetadata
  ipAddress?: string
  userAgent?: string
}

export interface AuditLogRepository {
  // Log an audit event
  log(input: LogAuditEventInput): Promise<void>

  // Query audit logs
  getWorkspaceLogs(workspaceId: string, options?: { limit?: number; offset?: number }): Promise<AuditLog[]>
  getUserLogs(workspaceId: string, userId: string, options?: { limit?: number; offset?: number }): Promise<AuditLog[]>
  getResourceLogs(workspaceId: string, resourceId: string, options?: { limit?: number; offset?: number }): Promise<AuditLog[]>

  // Retention management
  deleteLogsOlderThan(workspaceId: string, date: Date): Promise<number>
}
