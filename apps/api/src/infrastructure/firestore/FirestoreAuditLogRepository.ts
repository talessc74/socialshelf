import { adminFirestore } from '../firebase-admin.js'
import type { AuditLog, AuditLogRepository, LogAuditEventInput } from '@socialshelf/domain'

export class FirestoreAuditLogRepository implements AuditLogRepository {
  async log(input: LogAuditEventInput): Promise<void> {
    const ref = adminFirestore
      .collection('workspaces')
      .doc(input.workspaceId)
      .collection('audit_logs')
      .doc()

    await ref.set({
      uid: input.uid,
      action: input.action,
      resourceId: input.resourceId,
      resourceType: input.resourceType,
      timestamp: new Date(),
      metadata: input.metadata,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    })
  }

  async getWorkspaceLogs(workspaceId: string, options?: { limit?: number; offset?: number }): Promise<AuditLog[]> {
    let query = adminFirestore
      .collection('workspaces')
      .doc(workspaceId)
      .collection('audit_logs')
      .orderBy('timestamp', 'desc')

    if (options?.offset) {
      query = query.offset(options.offset)
    }

    if (options?.limit) {
      query = query.limit(options.limit)
    }

    const snapshot = await query.get()
    return snapshot.docs.map(doc => {
      const data = doc.data()
      return {
        id: doc.id,
        workspaceId,
        uid: data.uid,
        action: data.action,
        resourceId: data.resourceId,
        resourceType: data.resourceType,
        timestamp: data.timestamp.toDate(),
        metadata: data.metadata,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      }
    })
  }

  async getUserLogs(
    workspaceId: string,
    userId: string,
    options?: { limit?: number; offset?: number },
  ): Promise<AuditLog[]> {
    let query = adminFirestore
      .collection('workspaces')
      .doc(workspaceId)
      .collection('audit_logs')
      .where('uid', '==', userId)
      .orderBy('timestamp', 'desc')

    if (options?.offset) {
      query = query.offset(options.offset)
    }

    if (options?.limit) {
      query = query.limit(options.limit)
    }

    const snapshot = await query.get()
    return snapshot.docs.map(doc => {
      const data = doc.data()
      return {
        id: doc.id,
        workspaceId,
        uid: data.uid,
        action: data.action,
        resourceId: data.resourceId,
        resourceType: data.resourceType,
        timestamp: data.timestamp.toDate(),
        metadata: data.metadata,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      }
    })
  }

  async getResourceLogs(
    workspaceId: string,
    resourceId: string,
    options?: { limit?: number; offset?: number },
  ): Promise<AuditLog[]> {
    let query = adminFirestore
      .collection('workspaces')
      .doc(workspaceId)
      .collection('audit_logs')
      .where('resourceId', '==', resourceId)
      .orderBy('timestamp', 'desc')

    if (options?.offset) {
      query = query.offset(options.offset)
    }

    if (options?.limit) {
      query = query.limit(options.limit)
    }

    const snapshot = await query.get()
    return snapshot.docs.map(doc => {
      const data = doc.data()
      return {
        id: doc.id,
        workspaceId,
        uid: data.uid,
        action: data.action,
        resourceId: data.resourceId,
        resourceType: data.resourceType,
        timestamp: data.timestamp.toDate(),
        metadata: data.metadata,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      }
    })
  }

  async deleteLogsOlderThan(workspaceId: string, date: Date): Promise<number> {
    const snapshot = await adminFirestore
      .collection('workspaces')
      .doc(workspaceId)
      .collection('audit_logs')
      .where('timestamp', '<', date)
      .get()

    let deleted = 0
    for (const doc of snapshot.docs) {
      await doc.ref.delete()
      deleted++
    }

    return deleted
  }
}
