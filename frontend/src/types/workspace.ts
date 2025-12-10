/**
 * Frontend Workspace Type Definitions
 * TypeScript interfaces for workspace-related data structures
 */

export interface WorkspaceMember {
    uid: string;
    role: 'owner' | 'admin' | 'member' | 'viewer';
    joinedAt: string;
    displayName?: string;
    email?: string;
}

export interface Workspace {
    id: string;
    name: string;
    slug: string;
    owner: string;
    members: WorkspaceMember[];
    inviteCode: string;
    createdAt: string;
    updatedAt: string;
}

export interface WorkspaceResponse {
    success: boolean;
    workspace?: Workspace;
    workspaces?: Workspace[];
    message?: string;
}
