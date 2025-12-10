import { Response } from 'express';
import { db } from '../config/firebase';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

const eventsCollection = db.collection('events');

export const getEvents = async (req: AuthRequest, res: Response) => {
    try {
        const { workspaceId } = req.query;

        logger.debug(`Fetching events for user: ${req.user.uid}`, { workspaceId });

        let query = eventsCollection.where('userId', '==', req.user.uid);

        // Filter by workspace if provided
        if (workspaceId) {
            query = query.where('workspaceId', '==', workspaceId);
            logger.debug(`Filtering events by workspace: ${workspaceId}`);
        }

        const snapshot = await query.get();
        const events = snapshot.docs.map(doc => ({ _id: doc.id, ...doc.data() }));

        logger.success(`Successfully fetched ${events.length} events for user: ${req.user.uid}`);
        res.json(events);
    } catch (error) {
        logger.error('Error fetching events', error);
        res.status(500).json({ message: (error as Error).message });
    }
};

export const createEvent = async (req: AuthRequest, res: Response) => {
    const { title, description, startDate, endDate, isAllDay, recurrence, color, workspaceId } = req.body;

    try {
        logger.debug(`Creating new event for user: ${req.user.uid}`, { title, startDate, endDate, workspaceId });

        const newEvent = {
            userId: req.user.uid,
            createdBy: req.user.uid, // Track event creator for permission checks
            workspaceId: workspaceId || null,
            title,
            description,
            startDate,
            endDate,
            isAllDay,
            recurrence,
            color,
            createdAt: new Date().toISOString(),
        };

        const docRef = await eventsCollection.add(newEvent);

        logger.success(`Event created successfully with ID: ${docRef.id}`, { title });
        res.status(201).json({ _id: docRef.id, ...newEvent });
    } catch (error) {
        logger.error('Error creating event', error);
        res.status(500).json({ message: (error as Error).message });
    }
};

export const updateEvent = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    try {
        logger.debug(`Updating event ${id} for user: ${req.user.uid}`, req.body);

        const docRef = eventsCollection.doc(id);
        const doc = await docRef.get();

        if (!doc.exists) {
            logger.warn(`Event not found: ${id}`);
            return res.status(404).json({ message: 'Event not found' });
        }

        if (doc.data()?.userId !== req.user.uid) {
            logger.warn(`Unauthorized access attempt to event ${id} by user ${req.user.uid}`);
            return res.status(401).json({ message: 'Not authorized' });
        }

        await docRef.update(req.body);
        const updatedDoc = await docRef.get();

        logger.success(`Event ${id} updated successfully`);
        res.json({ _id: updatedDoc.id, ...updatedDoc.data() });
    } catch (error) {
        logger.error(`Error updating event ${id}`, error);
        res.status(500).json({ message: (error as Error).message });
    }
};

export const deleteEvent = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    try {
        logger.debug(`Deleting event ${id} for user: ${req.user.uid}`);

        const docRef = eventsCollection.doc(id);
        const doc = await docRef.get();

        if (!doc.exists) {
            logger.warn(`Event not found: ${id}`);
            return res.status(404).json({ message: 'Event not found' });
        }

        if (doc.data()?.userId !== req.user.uid) {
            logger.warn(`Unauthorized delete attempt for event ${id} by user ${req.user.uid}`);
            return res.status(401).json({ message: 'Not authorized' });
        }

        await docRef.delete();

        logger.success(`Event ${id} deleted successfully`);
        res.json({ message: 'Event removed' });
    } catch (error) {
        logger.error(`Error deleting event ${id}`, error);
        res.status(500).json({ message: (error as Error).message });
    }
};
