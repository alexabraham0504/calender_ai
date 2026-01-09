/**
 * @fileoverview Image Controller
 * @module controllers/imageController
 * 
 * Handles HTTP requests for calendar image management:
 * - Upload images
 * - Delete images
 * - List user images
 * - AI image generation
 * 
 * All endpoints require Firebase authentication.
 */

import { Request, Response } from 'express';
import { processAndUploadImage, deleteImage, listImages } from '../services/imageService';
import { generateAIImage, isAIImageEnabled } from '../services/aiImageAdapter';
import { logger } from '../utils/logger';
import { AIImageGenerateRequest } from '../types/image';

/**
 * POST /api/calendar/image/upload
 * Upload an image file
 */
export async function uploadImage(req: Request & { user?: any; file?: any }, res: Response): Promise<void> {
    try {
        const userId = req.user?.uid;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        if (!req.file) {
            res.status(400).json({ error: 'No file uploaded' });
            return;
        }

        const workspaceId = req.body.workspaceId;

        logger.info('Processing image upload', { userId, filename: req.file.originalname });

        const result = await processAndUploadImage(
            req.file.buffer,
            req.file.originalname,
            userId,
            workspaceId
        );

        res.status(200).json(result);
    } catch (error: any) {
        logger.error('Upload image error:', error);
        logger.error('Error details:', {
            message: error.message,
            stack: error.stack,
            code: error.code,
            name: error.name
        });
        res.status(500).json({
            error: error.message || 'Failed to upload image',
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
}

/**
 * POST /api/calendar/image/delete
 * Delete an image
 */
export async function deleteImageController(req: Request & { user?: any }, res: Response): Promise<void> {
    try {
        const userId = req.user?.uid;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const { imageId } = req.body;

        if (!imageId) {
            res.status(400).json({ error: 'imageId is required' });
            return;
        }

        await deleteImage(imageId, userId);

        res.status(200).json({ success: true, message: 'Image deleted successfully' });
    } catch (error: any) {
        logger.error('Delete image error:', error);
        res.status(500).json({ error: error.message || 'Failed to delete image' });
    }
}

/**
 * GET /api/calendar/image/list
 * List images for a user
 */
export async function listImagesController(req: Request & { user?: any }, res: Response): Promise<void> {
    try {
        const userId = req.user?.uid;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const workspaceId = req.query.workspaceId as string | undefined;
        const limit = parseInt(req.query.limit as string) || 50;
        const offset = parseInt(req.query.offset as string) || 0;

        const images = await listImages(userId, workspaceId, limit, offset);

        res.status(200).json({ images });
    } catch (error: any) {
        logger.error('List images error:', error);
        res.status(500).json({ error: error.message || 'Failed to list images' });
    }
}

/**
 * POST /api/calendar/ai/generate-image
 * Generate an AI image
 */
export async function generateAIImageController(req: Request & { user?: any }, res: Response): Promise<void> {
    try {
        const userId = req.user?.uid;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        if (!isAIImageEnabled()) {
            res.status(503).json({ error: 'AI image generation is not enabled' });
            return;
        }

        const aiRequest: AIImageGenerateRequest = req.body;

        if (!aiRequest.prompt) {
            res.status(400).json({ error: 'prompt is required' });
            return;
        }

        logger.info('Generating AI image', { userId, prompt: aiRequest.prompt });

        // Generate image
        const imageBuffer = await generateAIImage(aiRequest);

        // Upload to storage
        const filename = `ai_generated_${Date.now()}.jpg`;
        const result = await processAndUploadImage(
            imageBuffer,
            filename,
            userId,
            aiRequest.workspaceId
        );

        res.status(200).json(result);
    } catch (error: any) {
        logger.error('Generate AI image error:', error);
        res.status(500).json({ error: error.message || 'Failed to generate AI image' });
    }
}
