import type { Workspace, WorkspaceMember, WorkspaceRole } from '../entities/Workspace.js'

export interface WorkspaceRepository {
  // Workspace operations
  createWorkspace(workspace: Workspace): Promise<void>
  getWorkspace(workspaceId: string): Promise<Workspace | null>
  updateWorkspace(workspaceId: string, updates: Partial<Workspace>): Promise<void>
  deleteWorkspace(workspaceId: string): Promise<void>

  // Member operations
  addMember(workspaceId: string, member: WorkspaceMember): Promise<void>
  getMember(workspaceId: string, userId: string): Promise<WorkspaceMember | null>
  getMembers(workspaceId: string): Promise<WorkspaceMember[]>
  updateMember(workspaceId: string, userId: string, updates: Partial<WorkspaceMember>): Promise<void>
  removeMember(workspaceId: string, userId: string): Promise<void>

  // User's workspaces
  getUserWorkspaces(userId: string): Promise<Workspace[]>

  // Quota tracking
  incrementPostCount(workspaceId: string): Promise<void>
  decrementPostCount(workspaceId: string): Promise<void>
  resetMonthlyQuota(workspaceId: string): Promise<void>
}
