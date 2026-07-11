import { adminFirestore } from '../firebase-admin.js'
import type { Workspace, WorkspaceMember, WorkspaceRepository } from '@socialshelf/domain'

export class FirestoreWorkspaceRepository implements WorkspaceRepository {
  async createWorkspace(workspace: Workspace): Promise<void> {
    const ref = adminFirestore.collection('workspaces').doc(workspace.id)
    await ref.set({
      name: workspace.name,
      plan: workspace.plan,
      createdBy: workspace.createdBy,
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt,
      quotaLimits: workspace.quotaLimits,
      quotaUsage: workspace.quotaUsage,
      quotaResetAt: workspace.quotaResetAt,
      description: workspace.description ?? null,
      avatar: workspace.avatar ?? null,
    })
  }

  async getWorkspace(workspaceId: string): Promise<Workspace | null> {
    const doc = await adminFirestore.collection('workspaces').doc(workspaceId).get()
    if (!doc.exists) return null

    const data = doc.data()
    return {
      id: doc.id,
      name: data.name,
      plan: data.plan,
      createdBy: data.createdBy,
      createdAt: data.createdAt.toDate(),
      updatedAt: data.updatedAt.toDate(),
      quotaLimits: data.quotaLimits,
      quotaUsage: data.quotaUsage,
      quotaResetAt: data.quotaResetAt.toDate(),
      description: data.description,
      avatar: data.avatar,
    }
  }

  async updateWorkspace(workspaceId: string, updates: Partial<Workspace>): Promise<void> {
    const ref = adminFirestore.collection('workspaces').doc(workspaceId)
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    }

    if (updates.name) updateData.name = updates.name
    if (updates.plan) updateData.plan = updates.plan
    if (updates.description !== undefined) updateData.description = updates.description
    if (updates.avatar !== undefined) updateData.avatar = updates.avatar
    if (updates.quotaLimits) updateData.quotaLimits = updates.quotaLimits
    if (updates.quotaUsage) updateData.quotaUsage = updates.quotaUsage
    if (updates.quotaResetAt) updateData.quotaResetAt = updates.quotaResetAt

    await ref.update(updateData)
  }

  async deleteWorkspace(workspaceId: string): Promise<void> {
    const ref = adminFirestore.collection('workspaces').doc(workspaceId)
    await ref.delete()
  }

  async addMember(workspaceId: string, member: WorkspaceMember): Promise<void> {
    const ref = adminFirestore.collection('workspaces').doc(workspaceId).collection('members').doc(member.userId)
    await ref.set({
      role: member.role,
      status: member.status,
      invitedBy: member.invitedBy ?? null,
      invitedAt: member.invitedAt ?? null,
      inviteEmail: member.inviteEmail ?? null,
      acceptedAt: member.acceptedAt ?? null,
      lastAccessAt: member.lastAccessAt ?? null,
    })
  }

  async getMember(workspaceId: string, userId: string): Promise<WorkspaceMember | null> {
    const doc = await adminFirestore.collection('workspaces').doc(workspaceId).collection('members').doc(userId).get()
    if (!doc.exists) return null

    const data = doc.data()
    return {
      userId: doc.id,
      role: data.role,
      status: data.status,
      invitedBy: data.invitedBy,
      invitedAt: data.invitedAt?.toDate() ?? null,
      inviteEmail: data.inviteEmail,
      acceptedAt: data.acceptedAt?.toDate() ?? null,
      lastAccessAt: data.lastAccessAt?.toDate() ?? null,
    }
  }

  async getMembers(workspaceId: string): Promise<WorkspaceMember[]> {
    const snapshot = await adminFirestore.collection('workspaces').doc(workspaceId).collection('members').get()
    return snapshot.docs.map(doc => {
      const data = doc.data()
      return {
        userId: doc.id,
        role: data.role,
        status: data.status,
        invitedBy: data.invitedBy,
        invitedAt: data.invitedAt?.toDate() ?? null,
        inviteEmail: data.inviteEmail,
        acceptedAt: data.acceptedAt?.toDate() ?? null,
        lastAccessAt: data.lastAccessAt?.toDate() ?? null,
      }
    })
  }

  async updateMember(workspaceId: string, userId: string, updates: Partial<WorkspaceMember>): Promise<void> {
    const ref = adminFirestore.collection('workspaces').doc(workspaceId).collection('members').doc(userId)
    const updateData: Record<string, unknown> = {}

    if (updates.role) updateData.role = updates.role
    if (updates.status) updateData.status = updates.status
    if (updates.acceptedAt !== undefined) updateData.acceptedAt = updates.acceptedAt
    if (updates.lastAccessAt !== undefined) updateData.lastAccessAt = updates.lastAccessAt

    if (Object.keys(updateData).length > 0) {
      await ref.update(updateData)
    }
  }

  async removeMember(workspaceId: string, userId: string): Promise<void> {
    const ref = adminFirestore.collection('workspaces').doc(workspaceId).collection('members').doc(userId)
    await ref.delete()
  }

  async getUserWorkspaces(userId: string): Promise<Workspace[]> {
    const memberSnapshot = await adminFirestore.collectionGroup('members').where('userId', '==', userId).get()

    const workspaces: Workspace[] = []
    for (const doc of memberSnapshot.docs) {
      const workspaceId = doc.ref.parent.parent?.id
      if (!workspaceId) continue

      const workspace = await this.getWorkspace(workspaceId)
      if (workspace) workspaces.push(workspace)
    }

    return workspaces
  }

  async incrementPostCount(workspaceId: string): Promise<void> {
    const ref = adminFirestore.collection('workspaces').doc(workspaceId)
    await ref.update({
      'quotaUsage.postsThisMonth': adminFirestore.FieldValue.increment(1),
    })
  }

  async decrementPostCount(workspaceId: string): Promise<void> {
    const ref = adminFirestore.collection('workspaces').doc(workspaceId)
    await ref.update({
      'quotaUsage.postsThisMonth': adminFirestore.FieldValue.increment(-1),
    })
  }

  async resetMonthlyQuota(workspaceId: string): Promise<void> {
    const ref = adminFirestore.collection('workspaces').doc(workspaceId)
    await ref.update({
      'quotaUsage.postsThisMonth': 0,
      'quotaResetAt': new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    })
  }
}
