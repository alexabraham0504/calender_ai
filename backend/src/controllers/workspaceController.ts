/**
 * Workspace Controller
 * Handles all workspace-related business logic and database operations
 */

import { Response } from 'express';
import { db } from '../config/firebase';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import {
    Workspace,
    WorkspaceMember,
    CreateWorkspaceRequest,
    JoinWorkspaceRequest,
    UpdateWorkspaceRequest
} from '../types/workspace';
import {
    generateWorkspaceSlug,
    generateInviteCode,
    validateWorkspaceName,
    validateInviteCode
} from '../utils/workspaceUtils';

const workspacesCollection = db.collection('workspaces');

/**
 * Get all workspaces for the authenticated user
 * @route GET /api/workspaces
 */
export const getUserWorkspaces = async (req: AuthRequest, res: Response) => {
    try {
        logger.debug(`Fetching workspaces for user: ${req.user.uid}`);

        // Query workspaces where user is a member
        const snapshot = await workspacesCollection
            .where('members', 'array-contains-any', [
                { uid: req.user.uid }
            ])
            .get();

        // Also query workspaces where user is owner (in case members array doesn't include owner)
        const ownerSnapshot = await workspacesCollection
            .where('owner', '==', req.user.uid)
            .get();

        // Combine and deduplicate results
        const workspaceMap = new Map<string, Workspace>();

        snapshot.docs.forEach(doc => {
            workspaceMap.set(doc.id, { id: doc.id, ...doc.data() } as Workspace);
        });

        ownerSnapshot.docs.forEach(doc => {
            workspaceMap.set(doc.id, { id: doc.id, ...doc.data() } as Workspace);
        });

        const workspaces = Array.from(workspaceMap.values());

        logger.success(`Successfully fetched ${workspaces.length} workspaces for user: ${req.user.uid}`);
        res.json({ success: true, workspaces });
    } catch (error) {
        logger.error('Error fetching user workspaces', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching workspaces',
            error: (error as Error).message
        });
    }
};

/**
 * Get a specific workspace by ID
 * @route GET /api/workspaces/:workspaceId
 */
export const getWorkspace = async (req: AuthRequest, res: Response) => {
    try {
        const { workspaceId } = req.params;

        logger.debug(`Fetching workspace: ${workspaceId}`);

        const workspaceDoc = await workspacesCollection.doc(workspaceId).get();

        if (!workspaceDoc.exists) {
            logger.warn(`Workspace not found: ${workspaceId}`);
            return res.status(404).json({ success: false, message: 'Workspace not found' });
        }

        const workspace = { id: workspaceDoc.id, ...workspaceDoc.data() } as Workspace;

        // Verify user is a member
        const isMember = workspace.members.some(member => member.uid === req.user.uid);

        if (!isMember && workspace.owner !== req.user.uid) {
            logger.warn(`User ${req.user.uid} attempted to access workspace ${workspaceId} without permission`);
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        logger.success(`Successfully fetched workspace: ${workspaceId}`);
        res.json({ success: true, workspace });
    } catch (error) {
        logger.error('Error fetching workspace', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching workspace',
            error: (error as Error).message
        });
    }
};

/**
 * Create a new workspace
 * @route POST /api/workspaces/create
 */
export const createWorkspace = async (req: AuthRequest, res: Response) => {
    try {
        const { name } = req.body as CreateWorkspaceRequest;

        logger.debug(`Creating workspace for user: ${req.user.uid}`, { name });

        // Validate workspace name
        const validation = validateWorkspaceName(name);
        if (!validation.valid) {
            logger.warn(`Invalid workspace name: ${validation.error}`);
            return res.status(400).json({ success: false, message: validation.error });
        }

        // Generate slug and invite code
        const slug = generateWorkspaceSlug(name);
        const inviteCode = generateInviteCode();

        // Create owner member object
        const ownerMember: WorkspaceMember = {
            uid: req.user.uid,
            role: 'owner',
            joinedAt: new Date().toISOString(),
            displayName: req.user.name || req.user.email || 'Unknown',
            email: req.user.email || undefined
        };

        // Create workspace object
        const newWorkspace: Omit<Workspace, 'id'> = {
            name: name.trim(),
            slug,
            owner: req.user.uid,
            members: [ownerMember],
            inviteCode,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        // Save to Firestore
        const docRef = await workspacesCollection.add(newWorkspace);

        const workspace: Workspace = {
            id: docRef.id,
            ...newWorkspace
        };

        logger.success(`Workspace created successfully: ${docRef.id}`, { name, slug });
        res.status(201).json({ success: true, workspace });
    } catch (error) {
        logger.error('Error creating workspace', error);
        res.status(500).json({
            success: false,
            message: 'Error creating workspace',
            error: (error as Error).message
        });
    }
};

/**
 * Join a workspace using invite code
 * @route POST /api/workspaces/join
 */
export const joinWorkspace = async (req: AuthRequest, res: Response) => {
    try {
        const { inviteCode } = req.body as JoinWorkspaceRequest;

        logger.debug(`User ${req.user.uid} attempting to join workspace with code: ${inviteCode}`);

        // Validate invite code
        const validation = validateInviteCode(inviteCode);
        if (!validation.valid) {
            logger.warn(`Invalid invite code: ${validation.error}`);
            return res.status(400).json({ success: false, message: validation.error });
        }

        // Find workspace by invite code
        const snapshot = await workspacesCollection
            .where('inviteCode', '==', inviteCode.toUpperCase())
            .limit(1)
            .get();

        if (snapshot.empty) {
            logger.warn(`No workspace found with invite code: ${inviteCode}`);
            return res.status(404).json({ success: false, message: 'Invalid invite code' });
        }

        const workspaceDoc = snapshot.docs[0];
        const workspace = { id: workspaceDoc.id, ...workspaceDoc.data() } as Workspace;

        // Check if user is already a member
        const isAlreadyMember = workspace.members.some(member => member.uid === req.user.uid);

        if (isAlreadyMember) {
            logger.info(`User ${req.user.uid} is already a member of workspace ${workspace.id}`);
            return res.status(200).json({
                success: true,
                workspace,
                message: 'You are already a member of this workspace'
            });
        }

        // Create new member object
        const newMember: WorkspaceMember = {
            uid: req.user.uid,
            role: 'member',
            joinedAt: new Date().toISOString(),
            displayName: req.user.name || req.user.email || 'Unknown',
            email: req.user.email || undefined
        };

        // Add user to members array
        const updatedMembers = [...workspace.members, newMember];

        await workspacesCollection.doc(workspace.id!).update({
            members: updatedMembers,
            updatedAt: new Date().toISOString()
        });

        const updatedWorkspace: Workspace = {
            ...workspace,
            members: updatedMembers,
            updatedAt: new Date().toISOString()
        };

        logger.success(`User ${req.user.uid} successfully joined workspace ${workspace.id}`);
        res.status(200).json({ success: true, workspace: updatedWorkspace });
    } catch (error) {
        logger.error('Error joining workspace', error);
        res.status(500).json({
            success: false,
            message: 'Error joining workspace',
            error: (error as Error).message
        });
    }
};

/**
 * Update workspace details (owner only)
 * @route PUT /api/workspaces/:workspaceId
 */
export const updateWorkspace = async (req: AuthRequest, res: Response) => {
    try {
        const { workspaceId } = req.params;
        const { name } = req.body as UpdateWorkspaceRequest;

        logger.debug(`Updating workspace ${workspaceId}`, { name });

        if (name) {
            // Validate new name
            const validation = validateWorkspaceName(name);
            if (!validation.valid) {
                logger.warn(`Invalid workspace name: ${validation.error}`);
                return res.status(400).json({ success: false, message: validation.error });
            }
        }

        const updateData: any = {
            updatedAt: new Date().toISOString()
        };

        if (name) {
            updateData.name = name.trim();
            updateData.slug = generateWorkspaceSlug(name);
        }

        await workspacesCollection.doc(workspaceId).update(updateData);

        const updatedDoc = await workspacesCollection.doc(workspaceId).get();
        const workspace = { id: updatedDoc.id, ...updatedDoc.data() } as Workspace;

        logger.success(`Workspace ${workspaceId} updated successfully`);
        res.json({ success: true, workspace });
    } catch (error) {
        logger.error('Error updating workspace', error);
        res.status(500).json({
            success: false,
            message: 'Error updating workspace',
            error: (error as Error).message
        });
    }
};

/**
 * Delete workspace (owner only)
 * @route DELETE /api/workspaces/:workspaceId
 */
export const deleteWorkspace = async (req: AuthRequest, res: Response) => {
    try {
        const { workspaceId } = req.params;

        logger.debug(`Deleting workspace ${workspaceId}`);

        // Delete all events in this workspace
        const eventsSnapshot = await db.collection('events')
            .where('workspaceId', '==', workspaceId)
            .get();

        const batch = db.batch();
        eventsSnapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });

        // Delete workspace
        batch.delete(workspacesCollection.doc(workspaceId));

        await batch.commit();

        logger.success(`Workspace ${workspaceId} and ${eventsSnapshot.size} events deleted successfully`);
        res.json({ success: true, message: 'Workspace deleted successfully' });
    } catch (error) {
        logger.error('Error deleting workspace', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting workspace',
            error: (error as Error).message
        });
    }
};

/**
 * Leave workspace (members only, not owner)
 * @route POST /api/workspaces/:workspaceId/leave
 */
export const leaveWorkspace = async (req: AuthRequest, res: Response) => {
    try {
        const { workspaceId } = req.params;

        logger.debug(`User ${req.user.uid} leaving workspace ${workspaceId}`);

        const workspaceDoc = await workspacesCollection.doc(workspaceId).get();

        if (!workspaceDoc.exists) {
            logger.warn(`Workspace not found: ${workspaceId}`);
            return res.status(404).json({ success: false, message: 'Workspace not found' });
        }

        const workspace = { id: workspaceDoc.id, ...workspaceDoc.data() } as Workspace;

        // Owner cannot leave their own workspace
        if (workspace.owner === req.user.uid) {
            logger.warn(`Owner ${req.user.uid} attempted to leave workspace ${workspaceId}`);
            return res.status(400).json({
                success: false,
                message: 'Workspace owner cannot leave. Delete the workspace instead.'
            });
        }

        // Remove user from members
        const updatedMembers = workspace.members.filter(member => member.uid !== req.user.uid);

        await workspacesCollection.doc(workspaceId).update({
            members: updatedMembers,
            updatedAt: new Date().toISOString()
        });

        logger.success(`User ${req.user.uid} left workspace ${workspaceId}`);
        res.json({ success: true, message: 'Successfully left workspace' });
    } catch (error) {
        logger.error('Error leaving workspace', error);
        res.status(500).json({
            success: false,
            message: 'Error leaving workspace',
            error: (error as Error).message
        });
    }
};
