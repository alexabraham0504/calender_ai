/**
 * Workspace Type Definitions
 * Defines all TypeScript interfaces and types for the workspace system
 */

export interface WorkspaceMember {
    uid: string;
    role: 'owner' | 'admin' | 'member' | 'viewer';
    joinedAt: string;
    displayName?: string;
    email?: string;
}

export interface Workspace {
    id?: string;
    name: string;
    slug: string;
    owner: string;
    members: WorkspaceMember[];
    inviteCode: string;
    createdAt: string;
    updatedAt: string;
}

export interface CreateWorkspaceRequest {
    name: string;
}

export interface JoinWorkspaceRequest {
    inviteCode: string;
}

export interface UpdateWorkspaceRequest {
    name?: string;
}

export interface WorkspaceResponse {
    success: boolean;
    workspace?: Workspace;
    workspaces?: Workspace[];
    message?: string;
}
