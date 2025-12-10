/**
 * Invite API Service
 * HTTP client for invitation operations (email and code-based)
 */

import { auth } from '../config/firebase';
import type { EmailInvite, InviteCode } from '../types/invite';
import type { Workspace } from '../types/workspace';
import { logger } from './logger';

const API_URL = 'http://localhost:5000/api';

/**
 * Get authentication token from Firebase
 */
const getAuthToken = async (): Promise<string> => {
    const user = auth.currentUser;
    if (!user) {
        throw new Error('User not authenticated');
    }
    return await user.getIdToken();
};

/**
 * Send an email invite
 */
export const sendEmailInvite = async (
    workspaceId: string,
    email: string,
    role: 'admin' | 'member' | 'viewer'
): Promise<EmailInvite> => {
    try {
        logger.api('POST', '/api/workspaces/invite/email', undefined, undefined, {
            workspaceId,
            email,
            role
        });

        const token = await getAuthToken();
        const response = await fetch(`${API_URL}/workspaces/invite/email`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ workspaceId, email, role })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to send invite');
        }

        const data = await response.json();
        logger.success('Email invite sent successfully', { email });
        return data.invite;
    } catch (error) {
        logger.error('Error sending email invite', error);
        throw error;
    }
};

/**
 * Accept an email invite
 */
export const acceptEmailInvite = async (inviteId: string): Promise<Workspace> => {
    try {
        logger.api('POST', '/api/workspaces/invite/accept', undefined, undefined, { inviteId });

        const token = await getAuthToken();
        const response = await fetch(`${API_URL}/workspaces/invite/accept`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ inviteId })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to accept invite');
        }

        const data = await response.json();
        logger.success('Email invite accepted successfully');
        return data.workspace;
    } catch (error) {
        logger.error('Error accepting email invite', error);
        throw error;
    }
};

/**
 * Get pending invites for current user
 */
export const getPendingInvites = async (): Promise<EmailInvite[]> => {
    try {
        logger.api('GET', '/api/workspaces/invite/pending');

        const token = await getAuthToken();
        const response = await fetch(`${API_URL}/workspaces/invite/pending`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to fetch pending invites');
        }

        const data = await response.json();
        logger.success('Pending invites fetched successfully', { count: data.invites?.length });
        return data.invites || [];
    } catch (error) {
        logger.error('Error fetching pending invites', error);
        throw error;
    }
};

/**
 * Get all invites for a workspace
 */
export const getWorkspaceInvites = async (workspaceId: string): Promise<EmailInvite[]> => {
    try {
        logger.api('GET', `/api/workspaces/${workspaceId}/invites`);

        const token = await getAuthToken();
        const response = await fetch(`${API_URL}/workspaces/invite/${workspaceId}/invites`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to fetch workspace invites');
        }

        const data = await response.json();
        logger.success('Workspace invites fetched successfully', { count: data.invites?.length });
        return data.invites || [];
    } catch (error) {
        logger.error('Error fetching workspace invites', error);
        throw error;
    }
};

/**
 * Cancel an invite
 */
export const cancelInvite = async (inviteId: string): Promise<void> => {
    try {
        logger.api('DELETE', `/api/workspaces/invite/${inviteId}`);

        const token = await getAuthToken();
        const response = await fetch(`${API_URL}/workspaces/invite/${inviteId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to cancel invite');
        }

        logger.success('Invite canceled successfully');
    } catch (error) {
        logger.error('Error canceling invite', error);
        throw error;
    }
};

/**
 * Generate an invite code
 */
export const generateInviteCode = async (
    workspaceId: string,
    validUntil?: string,
    maxUses?: number
): Promise<InviteCode> => {
    try {
        logger.api('POST', '/api/workspaces/invite/code/generate', undefined, undefined, {
            workspaceId,
            validUntil,
            maxUses
        });

        const token = await getAuthToken();
        const response = await fetch(`${API_URL}/workspaces/invite/code/generate`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ workspaceId, validUntil, maxUses })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to generate invite code');
        }

        const data = await response.json();
        logger.success('Invite code generated successfully');
        return data.inviteCode;
    } catch (error) {
        logger.error('Error generating invite code', error);
        throw error;
    }
};

/**
 * Accept an invite code
 */
export const acceptInviteCode = async (code: string): Promise<Workspace> => {
    try {
        logger.api('POST', '/api/workspaces/invite/code/accept', undefined, undefined, { code });

        const token = await getAuthToken();
        const response = await fetch(`${API_URL}/workspaces/invite/code/accept`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ code })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to accept invite code');
        }

        const data = await response.json();
        logger.success('Invite code accepted successfully');
        return data.workspace;
    } catch (error) {
        logger.error('Error accepting invite code', error);
        throw error;
    }
};

/**
 * Get active invite code for a workspace
 */
export const getActiveInviteCode = async (workspaceId: string): Promise<InviteCode | null> => {
    try {
        logger.api('GET', `/api/workspaces/${workspaceId}/invite/code`);

        const token = await getAuthToken();
        const response = await fetch(`${API_URL}/workspaces/invite/${workspaceId}/code`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to fetch invite code');
        }

        const data = await response.json();
        logger.success('Invite code fetched successfully');
        return data.inviteCode;
    } catch (error) {
        logger.error('Error fetching invite code', error);
        throw error;
    }
};

/**
 * Deactivate an invite code
 */
export const deactivateInviteCode = async (codeId: string): Promise<void> => {
    try {
        logger.api('DELETE', `/api/workspaces/invite/code/${codeId}`);

        const token = await getAuthToken();
        const response = await fetch(`${API_URL}/workspaces/invite/code/${codeId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to deactivate invite code');
        }

        logger.success('Invite code deactivated successfully');
    } catch (error) {
        logger.error('Error deactivating invite code', error);
        throw error;
    }
};
