import express from 'express';
import { protect } from '../middleware/auth';
import {
    getNotifications,
    getUnreadCount,
    markNotificationRead,
    markAllNotificationsRead,
    deleteNotification,
} from '../controllers/notificationController';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Get user notifications with filters
router.get('/list', getNotifications);

// Get unread notification count
router.get('/unread-count', getUnreadCount);

// Mark notification as read
router.post('/:id/read', markNotificationRead);

// Mark all notifications as read
router.post('/mark-all-read', markAllNotificationsRead);

// Delete notification
router.delete('/:id', deleteNotification);

export default router;
