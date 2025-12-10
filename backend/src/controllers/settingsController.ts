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

export const getNotificationSettings = async (req: AuthRequest, res: Response) => {
    try {
        logger.debug(`Fetching notification settings for user: ${req.user.uid}`);

        const docRef = db.collection('userSettings').doc(req.user.uid);
        const doc = await docRef.get();

        if (!doc.exists) {
            logger.info(`No notification settings found for user ${req.user.uid}, returning defaults`);
            return res.json({
                allowEmail: false,
                allowInApp: true,
                defaultReminderMinutes: 15,
                timezone: 'Asia/Kolkata',
            });
        }

        const data = doc.data();
        logger.success(`Notification settings fetched successfully for user: ${req.user.uid}`);

        res.json({
            allowEmail: data?.enableEmail || false,
            allowInApp: data?.enableInApp !== false,
            defaultReminderMinutes: data?.defaultReminderMinutes || 15,
            timezone: data?.timezone || 'Asia/Kolkata',
        });
    } catch (error) {
        logger.error('Error fetching notification settings', error);
        res.status(500).json({ message: (error as Error).message });
    }
};

export const updateNotificationSettings = async (req: AuthRequest, res: Response) => {
    try {
        const { allowEmail, allowInApp, defaultReminderMinutes, timezone } = req.body;

        logger.debug(`Updating notification settings for user: ${req.user.uid}`, req.body);

        const docRef = db.collection('userSettings').doc(req.user.uid);

        const updateData: any = {};

        if (typeof allowEmail !== 'undefined') updateData.enableEmail = allowEmail;
        if (typeof allowInApp !== 'undefined') updateData.enableInApp = allowInApp;
        if (defaultReminderMinutes) updateData.defaultReminderMinutes = defaultReminderMinutes;
        if (timezone) updateData.timezone = timezone;

        await docRef.set(updateData, { merge: true });

        const updatedDoc = await docRef.get();
        const data = updatedDoc.data();

        logger.success(`Notification settings updated successfully for user: ${req.user.uid}`);

        res.json({
            allowEmail: data?.enableEmail || false,
            allowInApp: data?.enableInApp !== false,
            defaultReminderMinutes: data?.defaultReminderMinutes || 15,
            timezone: data?.timezone || 'Asia/Kolkata',
        });
    } catch (error) {
        logger.error('Error updating notification settings', error);
        res.status(500).json({ message: (error as Error).message });
    }
};

