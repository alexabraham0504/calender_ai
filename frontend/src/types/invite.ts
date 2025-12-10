/**
 * Frontend Invite Type Definitions
 * TypeScript interfaces for invitation system
 */

export interface EmailInvite {
    id: string;
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
    id: string;
    workspaceId: string;
    code: string;
    validUntil: string;
    maxUses: number;
    usedCount: number;
    createdBy: string;
    createdAt: string;
    isActive: boolean;
}
