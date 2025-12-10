/**
 * AI Routes
 * API endpoints for AI-powered scheduling features
 */

import express from 'express';
import { protect } from '../middleware/auth';
import {
    parseIntent,
    suggestSlots,
    scheduleWithAI,
    getClarification,
    getAIStatus
} from '../controllers/aiController';

const router = express.Router();

// All routes require authentication
router.use(protect);

// AI endpoints
router.post('/parse', parseIntent);
router.post('/suggest', suggestSlots);
router.post('/schedule', scheduleWithAI);
router.post('/clarify', getClarification);
router.get('/status', getAIStatus);

export default router;
