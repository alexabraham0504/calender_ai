/**
 * Invite Routes
 * API endpoints for workspace invitations (email and code-based)
 */

import express from 'express';
import { protect } from '../middleware/auth';
import {
    sendInvite,
    acceptInvite,
    listInvites,
    getPendingInvites,
    cancelWorkspaceInvite,
    generateCode,
    acceptCode,
    getInviteCode,
    deactivateCode
} from '../controllers/inviteController';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Email invite routes
router.post('/email', sendInvite);
router.post('/accept', acceptInvite);
router.get('/pending', getPendingInvites);
router.delete('/:inviteId', cancelWorkspaceInvite);

// Invite code routes
router.post('/code/generate', generateCode);
router.post('/code/accept', acceptCode);
router.delete('/code/:codeId', deactivateCode);

// Workspace-specific routes
router.get('/:workspaceId/invites', listInvites);
router.get('/:workspaceId/code', getInviteCode);

export default router;
