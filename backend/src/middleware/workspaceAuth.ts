/**
 * Workspace Access Control Middleware
 * Validates workspace permissions and member access
 */

import { Response, NextFunction } from 'express';
import { db } from '../config/firebase';
import { AuthRequest } from './auth';
import { logger } from '../utils/logger';
import { Workspace } from '../types/workspace';

const workspacesCollection = db.collection('workspaces');

/**
 * Middleware to verify user is a member of the workspace
 * Attaches workspace data to request object
 */
export const verifyWorkspaceMember = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
) => {
    try {
        const workspaceId = req.params.workspaceId || req.body.workspaceId;

        if (!workspaceId) {
            logger.warn('Workspace ID not provided in request');
            return res.status(400).json({ message: 'Workspace ID is required' });
        }

        logger.debug(`Verifying workspace member access for workspace: ${workspaceId}`);

        const workspaceDoc = await workspacesCollection.doc(workspaceId).get();

        if (!workspaceDoc.exists) {
            logger.warn(`Workspace not found: ${workspaceId}`);
            return res.status(404).json({ message: 'Workspace not found' });
        }

        const workspace = { id: workspaceDoc.id, ...workspaceDoc.data() } as Workspace;

        // Check if user is a member
        const isMember = workspace.members.some(member => member.uid === req.user.uid);

        if (!isMember) {
            logger.warn(`User ${req.user.uid} is not a member of workspace ${workspaceId}`);
            return res.status(403).json({ message: 'Access denied: You are not a member of this workspace' });
        }

        // Attach workspace to request
        (req as any).workspace = workspace;

        logger.success(`User ${req.user.uid} verified as member of workspace ${workspaceId}`);
        next();
    } catch (error) {
        logger.error('Error verifying workspace member', error);
        res.status(500).json({ message: 'Error verifying workspace access', error: (error as Error).message });
    }
};

/**
 * Middleware to verify user is the owner of the workspace
 */
export const verifyWorkspaceOwner = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
) => {
    try {
        const workspaceId = req.params.workspaceId || req.body.workspaceId;

        if (!workspaceId) {
            logger.warn('Workspace ID not provided in request');
            return res.status(400).json({ message: 'Workspace ID is required' });
        }

        logger.debug(`Verifying workspace owner access for workspace: ${workspaceId}`);

        const workspaceDoc = await workspacesCollection.doc(workspaceId).get();

        if (!workspaceDoc.exists) {
            logger.warn(`Workspace not found: ${workspaceId}`);
            return res.status(404).json({ message: 'Workspace not found' });
        }

        const workspace = { id: workspaceDoc.id, ...workspaceDoc.data() } as Workspace;

        // Check if user is the owner
        if (workspace.owner !== req.user.uid) {
            logger.warn(`User ${req.user.uid} is not the owner of workspace ${workspaceId}`);
            return res.status(403).json({ message: 'Access denied: Only workspace owner can perform this action' });
        }

        // Attach workspace to request
        (req as any).workspace = workspace;

        logger.success(`User ${req.user.uid} verified as owner of workspace ${workspaceId}`);
        next();
    } catch (error) {
        logger.error('Error verifying workspace owner', error);
        res.status(500).json({ message: 'Error verifying workspace ownership', error: (error as Error).message });
    }
};

/**
 * Middleware to verify user has admin or owner role in workspace
 */
export const verifyWorkspaceAdmin = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
) => {
    try {
        const workspaceId = req.params.workspaceId || req.body.workspaceId;

        if (!workspaceId) {
            logger.warn('Workspace ID not provided in request');
            return res.status(400).json({ message: 'Workspace ID is required' });
        }

        logger.debug(`Verifying workspace admin access for workspace: ${workspaceId}`);

        const workspaceDoc = await workspacesCollection.doc(workspaceId).get();

        if (!workspaceDoc.exists) {
            logger.warn(`Workspace not found: ${workspaceId}`);
            return res.status(404).json({ message: 'Workspace not found' });
        }

        const workspace = { id: workspaceDoc.id, ...workspaceDoc.data() } as Workspace;

        // Check if user is admin or owner
        const userMember = workspace.members.find(member => member.uid === req.user.uid);

        if (!userMember || (userMember.role !== 'admin' && userMember.role !== 'owner')) {
            logger.warn(`User ${req.user.uid} does not have admin access to workspace ${workspaceId}`);
            return res.status(403).json({ message: 'Access denied: Admin or owner role required' });
        }

        // Attach workspace to request
        (req as any).workspace = workspace;

        logger.success(`User ${req.user.uid} verified as admin of workspace ${workspaceId}`);
        next();
    } catch (error) {
        logger.error('Error verifying workspace admin', error);
        res.status(500).json({ message: 'Error verifying workspace admin access', error: (error as Error).message });
    }
};
