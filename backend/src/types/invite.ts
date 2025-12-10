/**
 * Invite Type Definitions
 * Defines all TypeScript interfaces for the invitation system
 */

export interface EmailInvite {
    id?: string;
    workspaceId: string;
    email: string;
    role: 'admin' | 'member' | 'viewer';
    status: 'pending' | 'accepted' | 'declined' | 'expired';
    invitedBy: string;
    invitedByName?: string;
    createdAt: string;
    expiresAt: string;
    acceptedAt?: string;
}

export interface InviteCode {
    id?: string;
    workspaceId: string;
    code: string;
    validUntil: string;
    maxUses: number;
    usedCount: number;
    createdBy: string;
    createdAt: string;
    isActive: boolean;
}

export interface SendEmailInviteRequest {
    workspaceId: string;
    email: string;
    role: 'admin' | 'member' | 'viewer';
}

export interface AcceptEmailInviteRequest {
    inviteId: string;
}

export interface GenerateInviteCodeRequest {
    workspaceId: string;
    validUntil?: string;
    maxUses?: number;
}

export interface AcceptInviteCodeRequest {
    code: string;
}

export interface InviteResponse {
    success: boolean;
    invite?: EmailInvite;
    invites?: EmailInvite[];
    inviteCode?: InviteCode;
    workspace?: any;
    message?: string;
}
