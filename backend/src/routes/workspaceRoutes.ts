/**
 * Workspace Routes
 * Defines all API endpoints for workspace operations
 */

import express from 'express';
import { protect } from '../middleware/auth';
import { verifyWorkspaceOwner, verifyWorkspaceMember } from '../middleware/workspaceAuth';
import {
    getUserWorkspaces,
    getWorkspace,
    createWorkspace,
    joinWorkspace,
    updateWorkspace,
    deleteWorkspace,
    leaveWorkspace
} from '../controllers/workspaceController';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Get all workspaces for authenticated user
router.get('/', getUserWorkspaces);

// Create new workspace
router.post('/create', createWorkspace);

// Join workspace via invite code
router.post('/join', joinWorkspace);

// Get specific workspace (requires membership)
router.get('/:workspaceId', verifyWorkspaceMember, getWorkspace);

// Update workspace (requires owner)
router.put('/:workspaceId', verifyWorkspaceOwner, updateWorkspace);

// Delete workspace (requires owner)
router.delete('/:workspaceId', verifyWorkspaceOwner, deleteWorkspace);

// Leave workspace (requires membership, not owner)
router.post('/:workspaceId/leave', verifyWorkspaceMember, leaveWorkspace);

export default router;
