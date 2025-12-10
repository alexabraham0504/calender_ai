/**
 * Invite Controller
 * HTTP handlers for email invites and invite codes
 */

import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import {
    sendEmailInvite,
    acceptEmailInvite,
    getWorkspaceInvites,
    getUserPendingInvites,
    cancelInvite
} from '../services/inviteService';
import {
    generateInviteCode,
    acceptInviteCode,
    getActiveInviteCode,
    deactivateInviteCode
} from '../services/inviteCodeService';
import {
    SendEmailInviteRequest,
    AcceptEmailInviteRequest,
    GenerateInviteCodeRequest,
    AcceptInviteCodeRequest
} from '../types/invite';

/**
 * Send an email invite
 * @route POST /api/workspaces/invite/email
 */
export const sendInvite = async (req: AuthRequest, res: Response) => {
    try {
        const { workspaceId, email, role } = req.body as SendEmailInviteRequest;

        // Validation
        if (!workspaceId || !email || !role) {
            logger.warn('Missing required fields for email invite');
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: workspaceId, email, role'
            });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            logger.warn(`Invalid email format: ${email}`);
            return res.status(400).json({
                success: false,
                message: 'Invalid email format'
            });
        }

        // Validate role
        const validRoles = ['admin', 'member', 'viewer'];
        if (!validRoles.includes(role)) {
            logger.warn(`Invalid role: ${role}`);
            return res.status(400).json({
                success: false,
                message: 'Invalid role. Must be: admin, member, or viewer'
            });
        }

        logger.debug(`User ${req.user.uid} sending invite to ${email}`);

        const invite = await sendEmailInvite(
            workspaceId,
            email,
            role,
            req.user.uid,
            req.user.name || req.user.email || 'Unknown'
        );

        logger.success(`Email invite sent successfully to ${email}`);
        res.status(201).json({
            success: true,
            invite,
            message: 'Invite sent successfully'
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to send invite';
        logger.error('Error in sendInvite controller', error);

        const statusCode = errorMessage.includes('not found') ? 404 :
            errorMessage.includes('already') ? 409 :
                errorMessage.includes('Access denied') ? 403 : 500;

        res.status(statusCode).json({
            success: false,
            message: errorMessage
        });
    }
};

/**
 * Accept an email invite
 * @route POST /api/workspaces/invite/accept
 */
export const acceptInvite = async (req: AuthRequest, res: Response) => {
    try {
        const { inviteId } = req.body as AcceptEmailInviteRequest;

        if (!inviteId) {
            logger.warn('Missing inviteId');
            return res.status(400).json({
                success: false,
                message: 'Missing required field: inviteId'
            });
        }

        logger.debug(`User ${req.user.uid} accepting invite ${inviteId}`);

        const workspace = await acceptEmailInvite(
            inviteId,
            req.user.uid,
            req.user.email || '',
            req.user.name || req.user.email || 'Unknown'
        );

        logger.success(`User ${req.user.uid} accepted invite successfully`);
        res.json({
            success: true,
            workspace,
            message: 'Invite accepted successfully'
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to accept invite';
        logger.error('Error in acceptInvite controller', error);

        const statusCode = errorMessage.includes('not found') ? 404 :
            errorMessage.includes('expired') ? 410 :
                errorMessage.includes('already') ? 409 : 500;

        res.status(statusCode).json({
            success: false,
            message: errorMessage
        });
    }
};

/**
 * Get all invites for a workspace
 * @route GET /api/workspaces/:workspaceId/invites
 */
export const listInvites = async (req: AuthRequest, res: Response) => {
    try {
        const { workspaceId } = req.params;

        if (!workspaceId) {
            logger.warn('Missing workspaceId parameter');
            return res.status(400).json({
                success: false,
                message: 'Missing workspaceId parameter'
            });
        }

        logger.debug(`Fetching invites for workspace ${workspaceId}`);

        const invites = await getWorkspaceInvites(workspaceId, req.user.uid);

        logger.success(`Retrieved ${invites.length} invites for workspace ${workspaceId}`);
        res.json({
            success: true,
            invites
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to fetch invites';
        logger.error('Error in listInvites controller', error);

        const statusCode = errorMessage.includes('not found') ? 404 :
            errorMessage.includes('Access denied') ? 403 : 500;

        res.status(statusCode).json({
            success: false,
            message: errorMessage
        });
    }
};

/**
 * Get pending invites for current user
 * @route GET /api/workspaces/invite/pending
 */
export const getPendingInvites = async (req: AuthRequest, res: Response) => {
    try {
        const userEmail = req.user.email || '';

        if (!userEmail) {
            logger.warn('User email not available');
            return res.status(400).json({
                success: false,
                message: 'User email not available'
            });
        }

        logger.debug(`Fetching pending invites for ${userEmail}`);

        const invites = await getUserPendingInvites(userEmail);

        logger.success(`Found ${invites.length} pending invites for user`);
        res.json({
            success: true,
            invites
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to fetch pending invites';
        logger.error('Error in getPendingInvites controller', error);

        res.status(500).json({
            success: false,
            message: errorMessage
        });
    }
};

/**
 * Cancel an invite
 * @route DELETE /api/workspaces/invite/:inviteId
 */
export const cancelWorkspaceInvite = async (req: AuthRequest, res: Response) => {
    try {
        const { inviteId } = req.params;

        if (!inviteId) {
            logger.warn('Missing inviteId parameter');
            return res.status(400).json({
                success: false,
                message: 'Missing inviteId parameter'
            });
        }

        logger.debug(`Canceling invite ${inviteId}`);

        await cancelInvite(inviteId, req.user.uid);

        logger.success(`Invite ${inviteId} canceled successfully`);
        res.json({
            success: true,
            message: 'Invite canceled successfully'
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to cancel invite';
        logger.error('Error in cancelWorkspaceInvite controller', error);

        const statusCode = errorMessage.includes('not found') ? 404 :
            errorMessage.includes('Access denied') ? 403 : 500;

        res.status(statusCode).json({
            success: false,
            message: errorMessage
        });
    }
};

/**
 * Generate an invite code
 * @route POST /api/workspaces/invite/code/generate
 */
export const generateCode = async (req: AuthRequest, res: Response) => {
    try {
        const { workspaceId, validUntil, maxUses } = req.body as GenerateInviteCodeRequest;

        if (!workspaceId) {
            logger.warn('Missing workspaceId');
            return res.status(400).json({
                success: false,
                message: 'Missing required field: workspaceId'
            });
        }

        logger.debug(`Generating invite code for workspace ${workspaceId}`);

        const inviteCode = await generateInviteCode(
            workspaceId,
            req.user.uid,
            validUntil,
            maxUses
        );

        logger.success(`Invite code generated successfully for workspace ${workspaceId}`);
        res.status(201).json({
            success: true,
            inviteCode,
            message: 'Invite code generated successfully'
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to generate invite code';
        logger.error('Error in generateCode controller', error);

        const statusCode = errorMessage.includes('not found') ? 404 :
            errorMessage.includes('Access denied') ? 403 : 500;

        res.status(statusCode).json({
            success: false,
            message: errorMessage
        });
    }
};

/**
 * Accept an invite code
 * @route POST /api/workspaces/invite/code/accept
 */
export const acceptCode = async (req: AuthRequest, res: Response) => {
    try {
        const { code } = req.body as AcceptInviteCodeRequest;

        if (!code) {
            logger.warn('Missing code');
            return res.status(400).json({
                success: false,
                message: 'Missing required field: code'
            });
        }

        logger.debug(`User ${req.user.uid} accepting invite code ${code}`);

        const workspace = await acceptInviteCode(
            code,
            req.user.uid,
            req.user.email || '',
            req.user.name || req.user.email || 'Unknown'
        );

        logger.success(`User ${req.user.uid} joined workspace via invite code`);
        res.json({
            success: true,
            workspace,
            message: 'Successfully joined workspace'
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to accept invite code';
        logger.error('Error in acceptCode controller', error);

        const statusCode = errorMessage.includes('Invalid') ? 400 :
            errorMessage.includes('expired') ? 410 :
                errorMessage.includes('maximum uses') ? 410 :
                    errorMessage.includes('already') ? 409 : 500;

        res.status(statusCode).json({
            success: false,
            message: errorMessage
        });
    }
};

/**
 * Get active invite code for a workspace
 * @route GET /api/workspaces/:workspaceId/invite/code
 */
export const getInviteCode = async (req: AuthRequest, res: Response) => {
    try {
        const { workspaceId } = req.params;

        if (!workspaceId) {
            logger.warn('Missing workspaceId parameter');
            return res.status(400).json({
                success: false,
                message: 'Missing workspaceId parameter'
            });
        }

        logger.debug(`Fetching invite code for workspace ${workspaceId}`);

        const inviteCode = await getActiveInviteCode(workspaceId, req.user.uid);

        if (!inviteCode) {
            return res.json({
                success: true,
                inviteCode: null,
                message: 'No active invite code found'
            });
        }

        logger.success(`Retrieved invite code for workspace ${workspaceId}`);
        res.json({
            success: true,
            inviteCode
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to fetch invite code';
        logger.error('Error in getInviteCode controller', error);

        const statusCode = errorMessage.includes('not found') ? 404 :
            errorMessage.includes('Access denied') ? 403 : 500;

        res.status(statusCode).json({
            success: false,
            message: errorMessage
        });
    }
};

/**
 * Deactivate an invite code
 * @route DELETE /api/workspaces/invite/code/:codeId
 */
export const deactivateCode = async (req: AuthRequest, res: Response) => {
    try {
        const { codeId } = req.params;

        if (!codeId) {
            logger.warn('Missing codeId parameter');
            return res.status(400).json({
                success: false,
                message: 'Missing codeId parameter'
            });
        }

        logger.debug(`Deactivating invite code ${codeId}`);

        await deactivateInviteCode(codeId, req.user.uid);

        logger.success(`Invite code ${codeId} deactivated successfully`);
        res.json({
            success: true,
            message: 'Invite code deactivated successfully'
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to deactivate invite code';
        logger.error('Error in deactivateCode controller', error);

        const statusCode = errorMessage.includes('not found') ? 404 :
            errorMessage.includes('Access denied') ? 403 : 500;

        res.status(statusCode).json({
            success: false,
            message: errorMessage
        });
    }
};
