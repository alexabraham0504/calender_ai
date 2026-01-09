/**
 * @fileoverview Calendar Image Routes
 * @module routes/calendarRoutes
 * 
 * Defines Express routes for calendar image integration:
 * - Image management (upload, delete, list)
 * - Layout management (save, get, delete)
 * - AI image generation
 * - Print exports (PDF, PNG)
 * 
 * All routes require Firebase authentication via protect middleware.
 * File uploads use multer middleware.
 * 
 * Usage:
 *   import calendarRoutes from './routes/calendarRoutes';
 *   app.use('/api/calendar', calendarRoutes);
 */

import express from 'express';
import multer from 'multer';
import { protect } from '../middleware/auth';
import {
    uploadImage,
    deleteImageController,
    listImagesController,
    generateAIImageController,
} from '../controllers/imageController';
import {
    saveLayout,
    getLayout,
    deleteLayout,
} from '../controllers/layoutController';
import {
    generatePDF,
    generatePNG,
} from '../controllers/printController';

const router = express.Router();

// Configure multer for memory storage (we'll process in imageService)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: parseInt(process.env.MAX_UPLOAD_MB || '10') * 1024 * 1024,
    },
    fileFilter: (req, file, cb) => {
        // Accept images only
        if (!file.mimetype.startsWith('image/')) {
            cb(new Error('Only image files are allowed'));
            return;
        }
        cb(null, true);
    },
});

// ===== IMAGE ROUTES =====

/**
 * POST /api/calendar/image/upload
 * Upload an image file
 * Body: multipart/form-data with 'image' field
 * Optional: workspaceId
 */
router.post('/image/upload', protect, upload.single('image'), uploadImage);

/**
 * POST /api/calendar/image/delete
 * Delete an image
 * Body: { imageId: string }
 */
router.post('/image/delete', protect, deleteImageController);

/**
 * GET /api/calendar/image/list
 * List images for the authenticated user
 * Query: workspaceId?, limit?, offset?
 */
router.get('/image/list', protect, listImagesController);

// ===== LAYOUT ROUTES =====

/**
 * POST /api/calendar/layout/save
 * Save or update a calendar image layout
 * Body: SaveLayoutRequest
 */
router.post('/layout/save', protect, saveLayout);

/**
 * GET /api/calendar/layout/get
 * Get layout for a calendar view
 * Query: calendarView, year, month?, week?, day?, workspaceId?
 */
router.get('/layout/get', protect, getLayout);

/**
 * DELETE /api/calendar/layout/delete
 * Delete a layout
 * Body: { layoutId: string }
 */
router.delete('/layout/delete', protect, deleteLayout);

// ===== AI IMAGE GENERATION =====

/**
 * POST /api/calendar/ai/generate-image
 * Generate an AI image
 * Body: AIImageGenerateRequest
 */
router.post('/ai/generate-image', protect, generateAIImageController);

// ===== PRINT ROUTES =====

/**
 * POST /api/calendar/print/pdf
 * Generate PDF export
 * Body: PrintPDFRequest
 */
router.post('/print/pdf', protect, generatePDF);

/**
 * POST /api/calendar/print/png
 * Generate PNG export
 * Body: PrintPDFRequest
 */
router.post('/print/png', protect, generatePNG);

// ===== TEST ROUTES =====
import testRoutes from './calendarTestRoutes';
router.use('/', testRoutes);

export default router;

