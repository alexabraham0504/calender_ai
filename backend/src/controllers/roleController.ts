/**
 * Role Management Controller
 * Handles HTTP requests for role and member management operations
 */

import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { updateMemberRole, removeMember, getWorkspaceMembers } from '../services/roleService';
import { UpdateRoleRequest, RemoveMemberRequest } from '../types/roles';

/**
 * Update a member's role in a workspace
 * @route POST /api/workspaces/roles/update
 */
export const updateRole = async (req: AuthRequest, res: Response) => {
    try {
        const { workspaceId, targetUserId, newRole } = req.body as UpdateRoleRequest;

        // Validation
        if (!workspaceId || !targetUserId || !newRole) {
            logger.warn('Missing required fields for role update');
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: workspaceId, targetUserId, newRole'
            });
        }

        // Validate role value
        const validRoles = ['owner', 'admin', 'member', 'viewer'];
        if (!validRoles.includes(newRole)) {
            logger.warn(`Invalid role value: ${newRole}`);
            return res.status(400).json({
                success: false,
                message: 'Invalid role. Must be: owner, admin, member, or viewer'
            });
        }

        logger.debug(`User ${req.user.uid} updating role for ${targetUserId} to ${newRole}`);

        const workspace = await updateMemberRole(
            workspaceId,
            req.user.uid,
            targetUserId,
            newRole
        );

        logger.success(`Role updated successfully in workspace ${workspaceId}`);
        res.json({
            success: true,
            workspace,
            message: 'Role updated successfully'
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to update role';
        logger.error('Error in updateRole controller', error);

        // Determine appropriate status code
        const statusCode = errorMessage.includes('not found') ? 404 :
            errorMessage.includes('permissions') ? 403 :
                errorMessage.includes('not a member') ? 403 : 500;

        res.status(statusCode).json({
            success: false,
            message: errorMessage
        });
    }
};

/**
 * Remove a member from a workspace
 * @route POST /api/workspaces/members/remove
 */
export const removeMemberFromWorkspace = async (req: AuthRequest, res: Response) => {
    try {
        const { workspaceId, targetUserId } = req.body as RemoveMemberRequest;

        // Validation
        if (!workspaceId || !targetUserId) {
            logger.warn('Missing required fields for member removal');
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: workspaceId, targetUserId'
            });
        }

        logger.debug(`User ${req.user.uid} removing ${targetUserId} from workspace ${workspaceId}`);

        const workspace = await removeMember(
            workspaceId,
            req.user.uid,
            targetUserId
        );

        logger.success(`Member removed successfully from workspace ${workspaceId}`);
        res.json({
            success: true,
            workspace,
            message: 'Member removed successfully'
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to remove member';
        logger.error('Error in removeMember controller', error);

        // Determine appropriate status code
        const statusCode = errorMessage.includes('not found') ? 404 :
            errorMessage.includes('permissions') ? 403 :
                errorMessage.includes('Cannot remove') ? 400 : 500;

        res.status(statusCode).json({
            success: false,
            message: errorMessage
        });
    }
};

/**
 * Get all members of a workspace
 * @route GET /api/workspaces/:workspaceId/members
 */
export const getMembers = async (req: AuthRequest, res: Response) => {
    try {
        const { workspaceId } = req.params;

        if (!workspaceId) {
            logger.warn('Missing workspaceId parameter');
            return res.status(400).json({
                success: false,
                message: 'Missing workspaceId parameter'
            });
        }

        logger.debug(`Fetching members for workspace ${workspaceId}`);

        const members = await getWorkspaceMembers(workspaceId, req.user.uid);

        logger.success(`Retrieved ${members.length} members for workspace ${workspaceId}`);
        res.json({
            success: true,
            members
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to fetch members';
        logger.error('Error in getMembers controller', error);

        const statusCode = errorMessage.includes('not found') ? 404 :
            errorMessage.includes('Access denied') ? 403 : 500;

        res.status(statusCode).json({
            success: false,
            message: errorMessage
        });
    }
};
