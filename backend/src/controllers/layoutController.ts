/**
 * @fileoverview Layout Controller
 * @module controllers/layoutController
 * 
 * Handles HTTP requests for calendar image layout management:
 * - Save/update layouts
 * - Get layouts for calendar views
 * - Delete layouts
 * 
 * Layouts define where and how images are placed on calendar views.
 * All endpoints require Firebase authentication.
 */

import { Request, Response } from 'express';
import { db } from '../config/firebase';
import { CalendarImageLayout, SaveLayoutRequest } from '../types/image';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import * as admin from 'firebase-admin';

/**
 * POST /api/calendar/layout/save
 * Save or update a calendar image layout
 */
export async function saveLayout(req: Request & { user?: any }, res: Response): Promise<void> {
    try {
        const userId = req.user?.uid;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const layoutRequest: SaveLayoutRequest = req.body;

        // Validation
        if (!layoutRequest.calendarView || !layoutRequest.year) {
            res.status(400).json({ error: 'calendarView and year are required' });
            return;
        }

        if (!layoutRequest.elements || !Array.isArray(layoutRequest.elements)) {
            res.status(400).json({ error: 'elements must be an array' });
            return;
        }

        // Generate or use existing layout ID
        const layoutId = layoutRequest.layoutId || uuidv4();

        // Build layout document
        const layoutDoc: Omit<CalendarImageLayout, 'createdAt' | 'updatedAt'> & { createdAt?: any; updatedAt: any } = {
            id: layoutId,
            userId,
            calendarView: layoutRequest.calendarView,
            year: layoutRequest.year,
            month: layoutRequest.month,
            week: layoutRequest.week,
            day: layoutRequest.day,
            workspaceId: layoutRequest.workspaceId,
            elements: layoutRequest.elements,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        // If new layout, add createdAt
        if (!layoutRequest.layoutId) {
            layoutDoc.createdAt = admin.firestore.FieldValue.serverTimestamp();
        }

        // Save to Firestore with transaction
        await db.runTransaction(async (transaction) => {
            const layoutRef = db.collection('calendarImageLayouts').doc(layoutId);

            if (layoutRequest.layoutId) {
                // Update existing
                const existing = await transaction.get(layoutRef);
                if (!existing.exists) {
                    throw new Error('Layout not found');
                }

                const existingData = existing.data() as CalendarImageLayout;
                if (existingData.userId !== userId) {
                    throw new Error('Unauthorized to modify this layout');
                }

                transaction.update(layoutRef, layoutDoc);
            } else {
                // Create new
                transaction.set(layoutRef, layoutDoc);
            }
        });

        logger.info('Layout saved', { layoutId, userId, view: layoutRequest.calendarView });

        res.status(200).json({
            success: true,
            layoutId,
            message: layoutRequest.layoutId ? 'Layout updated' : 'Layout created'
        });
    } catch (error: any) {
        logger.error('Save layout error:', error);
        res.status(500).json({ error: error.message || 'Failed to save layout' });
    }
}

/**
 * GET /api/calendar/layout/get
 * Get layout for a specific calendar view
 */
export async function getLayout(req: Request & { user?: any }, res: Response): Promise<void> {
    try {
        const userId = req.user?.uid;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const { calendarView, year, month, week, day, workspaceId } = req.query;

        if (!calendarView || !year) {
            res.status(400).json({ error: 'calendarView and year are required' });
            return;
        }

        // Build query
        let query = db.collection('calendarImageLayouts')
            .where('userId', '==', userId)
            .where('calendarView', '==', calendarView)
            .where('year', '==', parseInt(year as string));

        if (month) {
            query = query.where('month', '==', parseInt(month as string));
        }

        if (week) {
            query = query.where('week', '==', parseInt(week as string));
        }

        if (day) {
            query = query.where('day', '==', day as string);
        }

        if (workspaceId) {
            query = query.where('workspaceId', '==', workspaceId);
        }

        const snapshot = await query.limit(1).get();

        if (snapshot.empty) {
            res.status(404).json({ error: 'Layout not found' });
            return;
        }

        const layout = snapshot.docs[0].data() as CalendarImageLayout;

        res.status(200).json({ layout });
    } catch (error: any) {
        logger.error('Get layout error:', error);
        res.status(500).json({ error: error.message || 'Failed to get layout' });
    }
}

/**
 * DELETE /api/calendar/layout/delete
 * Delete a layout
 */
export async function deleteLayout(req: Request & { user?: any }, res: Response): Promise<void> {
    try {
        const userId = req.user?.uid;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const { layoutId } = req.body;

        if (!layoutId) {
            res.status(400).json({ error: 'layoutId is required' });
            return;
        }

        // Check ownership and delete
        await db.runTransaction(async (transaction) => {
            const layoutRef = db.collection('calendarImageLayouts').doc(layoutId);
            const layoutDoc = await transaction.get(layoutRef);

            if (!layoutDoc.exists) {
                throw new Error('Layout not found');
            }

            const layoutData = layoutDoc.data() as CalendarImageLayout;
            if (layoutData.userId !== userId) {
                throw new Error('Unauthorized to delete this layout');
            }

            transaction.delete(layoutRef);
        });

        logger.info('Layout deleted', { layoutId, userId });

        res.status(200).json({ success: true, message: 'Layout deleted successfully' });
    } catch (error: any) {
        logger.error('Delete layout error:', error);
        res.status(500).json({ error: error.message || 'Failed to delete layout' });
    }
}
