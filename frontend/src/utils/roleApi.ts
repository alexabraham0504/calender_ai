/**
 * Role API Service
 * HTTP client for role and member management operations
 */

import { auth } from '../config/firebase';
import type { WorkspaceRole, MemberInfo } from '../types/roles';
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
 * Update a member's role in a workspace
 */
export const updateMemberRole = async (
    workspaceId: string,
    targetUserId: string,
    newRole: WorkspaceRole
): Promise<Workspace> => {
    try {
        logger.api('POST', '/api/workspaces/roles/update', undefined, undefined, {
            workspaceId,
            targetUserId,
            newRole
        });

        const token = await getAuthToken();
        const response = await fetch(`${API_URL}/workspaces/roles/update`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ workspaceId, targetUserId, newRole })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to update role');
        }

        const data = await response.json();

        if (!data.workspace) {
            throw new Error('Failed to update role');
        }

        logger.success('Role updated successfully', { targetUserId, newRole });
        return data.workspace;
    } catch (error) {
        logger.error('Error updating role', error);
        throw error;
    }
};

/**
 * Remove a member from a workspace
 */
export const removeMember = async (
    workspaceId: string,
    targetUserId: string
): Promise<Workspace> => {
    try {
        logger.api('POST', '/api/workspaces/roles/remove', undefined, undefined, {
            workspaceId,
            targetUserId
        });

        const token = await getAuthToken();
        const response = await fetch(`${API_URL}/workspaces/roles/remove`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ workspaceId, targetUserId })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to remove member');
        }

        const data = await response.json();

        if (!data.workspace) {
            throw new Error('Failed to remove member');
        }

        logger.success('Member removed successfully', { targetUserId });
        return data.workspace;
    } catch (error) {
        logger.error('Error removing member', error);
        throw error;
    }
};

/**
 * Get all members of a workspace
 */
export const getWorkspaceMembers = async (workspaceId: string): Promise<MemberInfo[]> => {
    try {
        logger.api('GET', `/api/workspaces/roles/${workspaceId}/members`);

        const token = await getAuthToken();
        const response = await fetch(`${API_URL}/workspaces/roles/${workspaceId}/members`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to fetch members');
        }

        const data = await response.json();

        logger.success('Members fetched successfully', { count: data.members?.length });
        return data.members || [];
    } catch (error) {
        logger.error('Error fetching members', error);
        throw error;
    }
};
