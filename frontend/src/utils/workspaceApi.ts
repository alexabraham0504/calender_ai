/**
 * Workspace API Service
 * Handles all HTTP requests to workspace endpoints
 */

import { auth } from '../config/firebase';
import type { Workspace, WorkspaceResponse } from '../types/workspace';
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
 * Get all workspaces for the current user
 */
export const getUserWorkspaces = async (): Promise<Workspace[]> => {
    try {
        logger.api('GET', '/api/workspaces');

        const token = await getAuthToken();
        const response = await fetch(`${API_URL}/workspaces`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch workspaces: ${response.statusText}`);
        }

        const data: WorkspaceResponse = await response.json();

        logger.success('Workspaces fetched successfully', { count: data.workspaces?.length });
        return data.workspaces || [];
    } catch (error) {
        logger.error('Error fetching workspaces', error);
        throw error;
    }
};

/**
 * Get a specific workspace by ID
 */
export const getWorkspace = async (workspaceId: string): Promise<Workspace> => {
    try {
        logger.api('GET', `/api/workspaces/${workspaceId}`);

        const token = await getAuthToken();
        const response = await fetch(`${API_URL}/workspaces/${workspaceId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch workspace: ${response.statusText}`);
        }

        const data: WorkspaceResponse = await response.json();

        if (!data.workspace) {
            throw new Error('Workspace not found');
        }

        logger.success('Workspace fetched successfully', { id: workspaceId });
        return data.workspace;
    } catch (error) {
        logger.error('Error fetching workspace', error);
        throw error;
    }
};

/**
 * Create a new workspace
 */
export const createWorkspace = async (name: string): Promise<Workspace> => {
    try {
        logger.api('POST', '/api/workspaces/create', undefined, undefined, { name });

        const token = await getAuthToken();
        const response = await fetch(`${API_URL}/workspaces/create`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to create workspace');
        }

        const data: WorkspaceResponse = await response.json();

        if (!data.workspace) {
            throw new Error('Failed to create workspace');
        }

        logger.success('Workspace created successfully', { name });
        return data.workspace;
    } catch (error) {
        logger.error('Error creating workspace', error);
        throw error;
    }
};

/**
 * Join a workspace using invite code
 */
export const joinWorkspace = async (inviteCode: string): Promise<Workspace> => {
    try {
        logger.api('POST', '/api/workspaces/join', undefined, undefined, { inviteCode });

        const token = await getAuthToken();
        const response = await fetch(`${API_URL}/workspaces/join`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ inviteCode })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to join workspace');
        }

        const data: WorkspaceResponse = await response.json();

        if (!data.workspace) {
            throw new Error('Failed to join workspace');
        }

        logger.success('Joined workspace successfully', { inviteCode });
        return data.workspace;
    } catch (error) {
        logger.error('Error joining workspace', error);
        throw error;
    }
};

/**
 * Update workspace details
 */
export const updateWorkspace = async (workspaceId: string, name: string): Promise<Workspace> => {
    try {
        logger.api('PUT', `/api/workspaces/${workspaceId}`, undefined, undefined, { name });

        const token = await getAuthToken();
        const response = await fetch(`${API_URL}/workspaces/${workspaceId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to update workspace');
        }

        const data: WorkspaceResponse = await response.json();

        if (!data.workspace) {
            throw new Error('Failed to update workspace');
        }

        logger.success('Workspace updated successfully', { workspaceId });
        return data.workspace;
    } catch (error) {
        logger.error('Error updating workspace', error);
        throw error;
    }
};

/**
 * Delete a workspace
 */
export const deleteWorkspace = async (workspaceId: string): Promise<void> => {
    try {
        logger.api('DELETE', `/api/workspaces/${workspaceId}`);

        const token = await getAuthToken();
        const response = await fetch(`${API_URL}/workspaces/${workspaceId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to delete workspace');
        }

        logger.success('Workspace deleted successfully', { workspaceId });
    } catch (error) {
        logger.error('Error deleting workspace', error);
        throw error;
    }
};

/**
 * Leave a workspace
 */
export const leaveWorkspace = async (workspaceId: string): Promise<void> => {
    try {
        logger.api('POST', `/api/workspaces/${workspaceId}/leave`);

        const token = await getAuthToken();
        const response = await fetch(`${API_URL}/workspaces/${workspaceId}/leave`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to leave workspace');
        }

        logger.success('Left workspace successfully', { workspaceId });
    } catch (error) {
        logger.error('Error leaving workspace', error);
        throw error;
    }
};
