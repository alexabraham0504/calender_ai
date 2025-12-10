import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { notificationService } from '../services/notificationService';
import { logger } from '../utils/logger';

export const getNotifications = async (req: AuthRequest, res: Response) => {
    try {
        const { type, read, limit = 20, startAfter } = req.query;

        logger.debug('Fetching notifications', {
            userId: req.user.uid,
            filters: { type, read, limit },
        });

        const notifications = await notificationService.getUserNotifications({
            userId: req.user.uid,
            type: type as any,
            read: read === 'true' ? true : read === 'false' ? false : undefined,
            limit: parseInt(limit as string),
            startAfter,
        });

        res.json({ notifications });
    } catch (error) {
        logger.error('Error fetching notifications', error);
        res.status(500).json({ message: 'Failed to fetch notifications' });
    }
};

export const getUnreadCount = async (req: AuthRequest, res: Response) => {
    try {
        const count = await notificationService.getUnreadCount(req.user.uid);
        res.json({ count });
    } catch (error) {
        logger.error('Error fetching unread count', error);
        res.status(500).json({ message: 'Failed to fetch unread count' });
    }
};

export const markNotificationRead = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;

        await notificationService.markRead(id, req.user.uid);

        logger.success('Notification marked as read', { notificationId: id });
        res.json({ success: true });
    } catch (error) {
        logger.error('Error marking notification as read', error);
        res.status(500).json({ message: (error as Error).message });
    }
};

export const markAllNotificationsRead = async (req: AuthRequest, res: Response) => {
    try {
        const count = await notificationService.markAllRead(req.user.uid);

        logger.success('All notifications marked as read', { count });
        res.json({ success: true, count });
    } catch (error) {
        logger.error('Error marking all notifications as read', error);
        res.status(500).json({ message: 'Failed to mark notifications as read' });
    }
};

export const deleteNotification = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;

        await notificationService.deleteNotification(id, req.user.uid);

        logger.success('Notification deleted', { notificationId: id });
        res.json({ success: true });
    } catch (error) {
        logger.error('Error deleting notification', error);
        res.status(500).json({ message: (error as Error).message });
    }
};
