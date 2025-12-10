/**
 * Role Service
 * Business logic for role management and permission validation
 */

import { db } from '../config/firebase';
import { logger } from '../utils/logger';
import { Workspace, WorkspaceMember } from '../types/workspace';
import { WorkspaceRole, canModifyRole, getRolePermissions } from '../types/roles';

const workspacesCollection = db.collection('workspaces');

/**
 * Update a member's role in a workspace
 */
export const updateMemberRole = async (
    workspaceId: string,
    requesterId: string,
    targetUserId: string,
    newRole: WorkspaceRole
): Promise<Workspace> => {
    try {
        logger.debug(`Updating role for user ${targetUserId} in workspace ${workspaceId}`);

        // Use transaction to ensure consistency
        const result = await db.runTransaction(async (transaction) => {
            const workspaceRef = workspacesCollection.doc(workspaceId);
            const workspaceDoc = await transaction.get(workspaceRef);

            if (!workspaceDoc.exists) {
                throw new Error('Workspace not found');
            }

            const workspace = { id: workspaceDoc.id, ...workspaceDoc.data() } as Workspace;

            // Find requester and target members
            const requester = workspace.members.find(m => m.uid === requesterId);
            const target = workspace.members.find(m => m.uid === targetUserId);

            if (!requester) {
                throw new Error('Requester is not a member of this workspace');
            }

            if (!target) {
                throw new Error('Target user is not a member of this workspace');
            }

            // Check if requester can modify target's role
            if (!canModifyRole(requester.role, target.role, newRole)) {
                throw new Error('Insufficient permissions to change this role');
            }

            // Cannot change owner's role
            if (target.role === 'owner') {
                throw new Error('Cannot change owner role');
            }

            // Cannot promote to owner
            if (newRole === 'owner') {
                throw new Error('Cannot promote to owner role');
            }

            // Update the member's role
            const updatedMembers = workspace.members.map(member =>
                member.uid === targetUserId
                    ? { ...member, role: newRole }
                    : member
            );

            // Update workspace
            transaction.update(workspaceRef, {
                members: updatedMembers,
                updatedAt: new Date().toISOString()
            });

            return {
                ...workspace,
                members: updatedMembers,
                updatedAt: new Date().toISOString()
            };
        });

        logger.success(`Role updated successfully for user ${targetUserId} to ${newRole}`);
        return result;
    } catch (error) {
        logger.error('Error updating member role', error);
        throw error;
    }
};

/**
 * Remove a member from a workspace
 */
export const removeMember = async (
    workspaceId: string,
    requesterId: string,
    targetUserId: string
): Promise<Workspace> => {
    try {
        logger.debug(`Removing user ${targetUserId} from workspace ${workspaceId}`);

        // Use transaction to ensure consistency
        const result = await db.runTransaction(async (transaction) => {
            const workspaceRef = workspacesCollection.doc(workspaceId);
            const workspaceDoc = await transaction.get(workspaceRef);

            if (!workspaceDoc.exists) {
                throw new Error('Workspace not found');
            }

            const workspace = { id: workspaceDoc.id, ...workspaceDoc.data() } as Workspace;

            // Find requester and target members
            const requester = workspace.members.find(m => m.uid === requesterId);
            const target = workspace.members.find(m => m.uid === targetUserId);

            if (!requester) {
                throw new Error('Requester is not a member of this workspace');
            }

            if (!target) {
                throw new Error('Target user is not a member of this workspace');
            }

            // Cannot remove owner
            if (target.role === 'owner') {
                throw new Error('Cannot remove workspace owner');
            }

            // Check permissions
            const requesterPermissions = getRolePermissions(requester.role);
            if (!requesterPermissions.canManageMembers) {
                throw new Error('Insufficient permissions to remove members');
            }

            // Admin cannot remove other admins
            if (requester.role === 'admin' && target.role === 'admin') {
                throw new Error('Admins cannot remove other admins');
            }

            // Remove the member
            const updatedMembers = workspace.members.filter(
                member => member.uid !== targetUserId
            );

            // Update workspace
            transaction.update(workspaceRef, {
                members: updatedMembers,
                updatedAt: new Date().toISOString()
            });

            return {
                ...workspace,
                members: updatedMembers,
                updatedAt: new Date().toISOString()
            };
        });

        logger.success(`Member ${targetUserId} removed successfully from workspace ${workspaceId}`);
        return result;
    } catch (error) {
        logger.error('Error removing member', error);
        throw error;
    }
};

/**
 * Get all members of a workspace with their details
 */
export const getWorkspaceMembers = async (
    workspaceId: string,
    requesterId: string
): Promise<WorkspaceMember[]> => {
    try {
        logger.debug(`Fetching members for workspace ${workspaceId}`);

        const workspaceDoc = await workspacesCollection.doc(workspaceId).get();

        if (!workspaceDoc.exists) {
            throw new Error('Workspace not found');
        }

        const workspace = { id: workspaceDoc.id, ...workspaceDoc.data() } as Workspace;

        // Verify requester is a member
        const isMember = workspace.members.some(m => m.uid === requesterId);
        if (!isMember) {
            throw new Error('Access denied: Not a member of this workspace');
        }

        logger.success(`Retrieved ${workspace.members.length} members for workspace ${workspaceId}`);
        return workspace.members;
    } catch (error) {
        logger.error('Error fetching workspace members', error);
        throw error;
    }
};

/**
 * Check if user can edit a specific event
 */
export const canEditEvent = (
    userRole: WorkspaceRole,
    userId: string,
    eventCreatorId: string
): boolean => {
    const permissions = getRolePermissions(userRole);

    // Owners and admins can edit all events
    if (permissions.canEditAllEvents) {
        return true;
    }

    // Members can edit their own events
    if (permissions.canEditOwnEvents && userId === eventCreatorId) {
        return true;
    }

    // Viewers cannot edit
    return false;
};

/**
 * Check if user can create events
 */
export const canCreateEvent = (userRole: WorkspaceRole): boolean => {
    const permissions = getRolePermissions(userRole);
    return permissions.canCreateEvents;
};

/**
 * Check if user can delete an event
 */
export const canDeleteEvent = (
    userRole: WorkspaceRole,
    userId: string,
    eventCreatorId: string
): boolean => {
    // Same logic as edit for now
    return canEditEvent(userRole, userId, eventCreatorId);
};
