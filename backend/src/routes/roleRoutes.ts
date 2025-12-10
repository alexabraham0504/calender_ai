/**
 * Role Management Routes
 * API endpoints for role and member management
 */

import express from 'express';
import { protect } from '../middleware/auth';
import { updateRole, removeMemberFromWorkspace, getMembers } from '../controllers/roleController';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Update member role in workspace
router.post('/update', updateRole);

// Remove member from workspace
router.post('/remove', removeMemberFromWorkspace);

// Get workspace members
router.get('/:workspaceId/members', getMembers);

export default router;
