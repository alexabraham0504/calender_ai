import { Response } from 'express';
import { db } from '../config/firebase';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

export const getSettings = async (req: AuthRequest, res: Response) => {
    try {
        logger.debug(`Fetching settings for user: ${req.user.uid}`);

        const docRef = db.collection('users').doc(req.user.uid).collection('settings').doc('general');
        const doc = await docRef.get();

        if (!doc.exists) {
            logger.info(`No settings found for user ${req.user.uid}, returning defaults`);
            // Return defaults if no settings exist
            return res.json({
                theme: 'light',
                defaultView: 'month',
                timeFormat: '12h',
                defaultColor: 'blue',
            });
        }

        logger.success(`Settings fetched successfully for user: ${req.user.uid}`);
        res.json(doc.data());
    } catch (error) {
        logger.error('Error fetching settings', error);
        res.status(500).json({ message: (error as Error).message });
    }
};

export const updateSettings = async (req: AuthRequest, res: Response) => {
    try {
        logger.debug(`Updating settings for user: ${req.user.uid}`, req.body);

        const docRef = db.collection('users').doc(req.user.uid).collection('settings').doc('general');

        await docRef.set(req.body, { merge: true });

        const updatedDoc = await docRef.get();

        logger.success(`Settings updated successfully for user: ${req.user.uid}`);
        res.json(updatedDoc.data());
    } catch (error) {
        logger.error('Error updating settings', error);
        res.status(500).json({ message: (error as Error).message });
    }
};
