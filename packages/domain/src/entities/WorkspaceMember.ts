import type { WorkspaceRole } from './Workspace.js'

export type MembershipStatus = 'pending' | 'active' | 'removed'

export interface WorkspaceMember {
  // userId é a chave do documento em Firestore: /workspaces/{workspaceId}/members/{userId}
  userId: string
  role: WorkspaceRole
  status: MembershipStatus

  // Metadata de convite
  invitedBy: string | null // uid de quem convidou
  invitedAt: Date | null
  inviteEmail?: string | null
  acceptedAt: Date | null

  // Tracking de acesso
  lastAccessAt: Date | null
}
