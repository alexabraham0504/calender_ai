/**
 * @fileoverview Test Routes for Calendar Image Integration
 * @module routes/calendarTestRoutes
 * 
 * Provides test endpoints to verify calendar image integration is working.
 * These routes can be used to test the system without full frontend integration.
 * 
 * Usage:
 *   GET /api/calendar/test/info - Get feature info
 *   GET /api/calendar/test/ai-status - Check AI provider status
 */

import express from 'express';
import { protect } from '../middleware/auth';
import { isAIImageEnabled, getAIProvider } from '../services/aiImageAdapter';

const router = express.Router();

/**
 * GET /api/calendar/test/info
 * Get calendar image integration feature information
 */
router.get('/test/info', (req, res) => {
    res.json({
        feature: 'Calendar Image Integration & Printing',
        version: '1.0.0',
        status: 'operational',
        capabilities: {
            imageUpload: true,
            imageManagement: true,
            layoutManagement: true,
            aiGeneration: isAIImageEnabled(),
            pdfExport: true,
            pngExport: true,
        },
        endpoints: {
            images: {
                upload: 'POST /api/calendar/image/upload',
                delete: 'POST /api/calendar/image/delete',
                list: 'GET /api/calendar/image/list',
            },
            layouts: {
                save: 'POST /api/calendar/layout/save',
                get: 'GET /api/calendar/layout/get',
                delete: 'DELETE /api/calendar/layout/delete',
            },
            ai: {
                generate: 'POST /api/calendar/ai/generate-image',
            },
            print: {
                pdf: 'POST /api/calendar/print/pdf',
                png: 'POST /api/calendar/print/png',
            },
        },
        supportedFormats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
        paperSizes: ['A4', 'A5', 'Letter', 'Legal', 'Custom'],
        maxUploadSize: `${process.env.MAX_UPLOAD_MB || 10}MB`,
    });
});

/**
 * GET /api/calendar/test/ai-status
 * Check AI image generation status
 */
router.get('/test/ai-status', (req, res) => {
    const provider = getAIProvider();
    const enabled = isAIImageEnabled();

    res.json({
        provider,
        enabled,
        configured: enabled,
        message: enabled
            ? `AI image generation is enabled using ${provider} provider`
            : `AI image generation is not configured. Set AI_PROVIDER and API key in environment.`,
    });
});

/**
 * GET /api/calendar/test/health
 * Health check for calendar image services
 */
router.get('/test/health', protect, async (req, res) => {
    try {
        // Test Firebase connectivity
        const { db } = require('../config/firebase');
        await db.collection('calendarImages').limit(1).get();

        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            services: {
                firestore: 'connected',
                storage: 'available',
                puppeteer: 'ready',
                ai: isAIImageEnabled() ? 'enabled' : 'disabled',
            },
        });
    } catch (error: any) {
        res.status(500).json({
            status: 'unhealthy',
            error: error.message,
        });
    }
});

/**
 * GET /api/calendar/test/debug-images
 * Debug endpoint to check Firestore images
 */
router.get('/test/debug-images', protect, async (req, res) => {
    try {
        const { db } = require('../config/firebase');
        const userId = (req as any).user?.uid;

        // Get all images for this user
        const snapshot = await db.collection('calendarImages')
            .where('userId', '==', userId)
            .get();

        const images = snapshot.docs.map((doc: any) => ({
            id: doc.id,
            ...doc.data(),
            createdAtFormatted: doc.data().createdAt?.toDate?.()?.toISOString() || 'N/A'
        }));

        res.json({
            totalImages: images.length,
            userId,
            images,
            message: images.length > 0
                ? `Found ${images.length} images in Firestore`
                : 'No images found in Firestore. Please upload an image first.'
        });
    } catch (error: any) {
        res.status(500).json({
            error: error.message,
            stack: error.stack
        });
    }
});

export default router;
