import { db } from '../config/firebase';
import { logger } from '../utils/logger';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';

export interface Notification {
    id?: string;
    userId: string;
    type: 'eventReminder' | 'eventUpdate' | 'eventCreated' | 'eventDeleted' | 'workspaceInvite' | 'workspaceRoleUpdate' | 'aiSuggestion' | 'general';
    title: string;
    message: string;
    eventId?: string;
    workspaceId?: string;
    read: boolean;
    createdAt: Timestamp;
    metadata?: Record<string, any>;
}

export interface NotificationFilters {
    userId: string;
    type?: Notification['type'];
    read?: boolean;
    limit?: number;
    startAfter?: any;
}

export class NotificationService {
    private collection = db.collection('notifications');

    /**
     * Create a new notification
     */
    async createNotification(notification: Omit<Notification, 'id' | 'read' | 'createdAt'>): Promise<string> {
        try {
            // Check for duplicate notifications (idempotency)
            const duplicateCheck = await this.checkDuplicate(notification);
            if (duplicateCheck) {
                logger.info('Duplicate notification prevented', { notificationId: duplicateCheck });
                return duplicateCheck;
            }

            const docRef = await this.collection.add({
                ...notification,
                read: false,
                createdAt: FieldValue.serverTimestamp(),
            });

            logger.success('Notification created', {
                notificationId: docRef.id,
                userId: notification.userId,
                type: notification.type
            });

            return docRef.id;
        } catch (error) {
            logger.error('Error creating notification', error);
            throw error;
        }
    }

    /**
     * Check for duplicate notifications within last 5 minutes
     */
    private async checkDuplicate(notification: Omit<Notification, 'id' | 'read' | 'createdAt'>): Promise<string | null> {
        try {
            const fiveMinutesAgo = Timestamp.fromDate(new Date(Date.now() - 5 * 60 * 1000));

            let query = this.collection
                .where('userId', '==', notification.userId)
                .where('type', '==', notification.type)
                .where('createdAt', '>=', fiveMinutesAgo);

            if (notification.eventId) {
                query = query.where('eventId', '==', notification.eventId);
            }

            const snapshot = await query.limit(1).get();

            if (!snapshot.empty) {
                return snapshot.docs[0].id;
            }

            return null;
        } catch (error) {
            logger.error('Error checking duplicate notification', error);
            return null;
        }
    }

    /**
     * Get user notifications with filters
     */
    async getUserNotifications(filters: NotificationFilters): Promise<Notification[]> {
        try {
            let query: any = this.collection.where('userId', '==', filters.userId);

            if (filters.type) {
                query = query.where('type', '==', filters.type);
            }

            if (filters.read !== undefined) {
                query = query.where('read', '==', filters.read);
            }

            query = query.orderBy('createdAt', 'desc');

            if (filters.limit) {
                query = query.limit(filters.limit);
            }

            if (filters.startAfter) {
                query = query.startAfter(filters.startAfter);
            }

            const snapshot = await query.get();

            const notifications: Notification[] = snapshot.docs.map((doc: any) => ({
                id: doc.id,
                ...doc.data(),
            })) as Notification[];

            logger.debug('Fetched user notifications', {
                userId: filters.userId,
                count: notifications.length
            });

            return notifications;
        } catch (error) {
            logger.error('Error fetching user notifications', error);
            throw error;
        }
    }

    /**
     * Get unread notification count
     */
    async getUnreadCount(userId: string): Promise<number> {
        try {
            const snapshot = await this.collection
                .where('userId', '==', userId)
                .where('read', '==', false)
                .get();

            return snapshot.size;
        } catch (error) {
            logger.error('Error getting unread count', error);
            return 0;
        }
    }

    /**
     * Mark notification as read
     */
    async markRead(notificationId: string, userId: string): Promise<void> {
        try {
            const docRef = this.collection.doc(notificationId);
            const doc = await docRef.get();

            if (!doc.exists) {
                throw new Error('Notification not found');
            }

            const data = doc.data();
            if (data?.userId !== userId) {
                throw new Error('Unauthorized');
            }

            await docRef.update({ read: true });

            logger.success('Notification marked as read', { notificationId });
        } catch (error) {
            logger.error('Error marking notification as read', error);
            throw error;
        }
    }

    /**
     * Mark all notifications as read for a user
     */
    async markAllRead(userId: string): Promise<number> {
        try {
            const snapshot = await this.collection
                .where('userId', '==', userId)
                .where('read', '==', false)
                .get();

            const batch = db.batch();
            snapshot.docs.forEach((doc: any) => {
                batch.update(doc.ref, { read: true });
            });

            await batch.commit();

            logger.success('All notifications marked as read', {
                userId,
                count: snapshot.size
            });

            return snapshot.size;
        } catch (error) {
            logger.error('Error marking all notifications as read', error);
            throw error;
        }
    }

    /**
     * Delete notification
     */
    async deleteNotification(notificationId: string, userId: string): Promise<void> {
        try {
            const docRef = this.collection.doc(notificationId);
            const doc = await docRef.get();

            if (!doc.exists) {
                throw new Error('Notification not found');
            }

            const data = doc.data();
            if (data?.userId !== userId) {
                throw new Error('Unauthorized');
            }

            await docRef.delete();

            logger.success('Notification deleted', { notificationId });
        } catch (error) {
            logger.error('Error deleting notification', error);
            throw error;
        }
    }

    /**
     * Create event-related notifications
     */
    async notifyEventCreated(eventId: string, userId: string, eventTitle: string, workspaceId?: string): Promise<void> {
        try {
            await this.createNotification({
                userId,
                type: 'eventCreated',
                title: 'Event Created',
                message: `New event "${eventTitle}" has been created`,
                eventId,
                workspaceId,
            });
        } catch (error) {
            logger.error('Error creating event notification', error);
        }
    }

    async notifyEventUpdated(eventId: string, userId: string, eventTitle: string, workspaceId?: string): Promise<void> {
        try {
            await this.createNotification({
                userId,
                type: 'eventUpdate',
                title: 'Event Updated',
                message: `Event "${eventTitle}" has been updated`,
                eventId,
                workspaceId,
            });
        } catch (error) {
            logger.error('Error creating event update notification', error);
        }
    }

    async notifyEventDeleted(eventId: string, userId: string, eventTitle: string, workspaceId?: string): Promise<void> {
        try {
            await this.createNotification({
                userId,
                type: 'eventDeleted',
                title: 'Event Deleted',
                message: `Event "${eventTitle}" has been deleted`,
                eventId,
                workspaceId,
            });
        } catch (error) {
            logger.error('Error creating event deletion notification', error);
        }
    }

    async notifyEventReminder(eventId: string, userId: string, eventTitle: string, startTime: Date): Promise<void> {
        try {
            const timeUntil = this.formatTimeUntil(startTime);

            await this.createNotification({
                userId,
                type: 'eventReminder',
                title: 'Event Reminder',
                message: `"${eventTitle}" starts ${timeUntil}`,
                eventId,
                metadata: { startTime: startTime.toISOString() },
            });
        } catch (error) {
            logger.error('Error creating event reminder notification', error);
        }
    }

    async notifyWorkspaceInvite(userId: string, workspaceId: string, workspaceName: string, invitedBy: string): Promise<void> {
        try {
            await this.createNotification({
                userId,
                type: 'workspaceInvite',
                title: 'Workspace Invitation',
                message: `${invitedBy} invited you to join "${workspaceName}"`,
                workspaceId,
                metadata: { invitedBy },
            });
        } catch (error) {
            logger.error('Error creating workspace invite notification', error);
        }
    }

    async notifyWorkspaceRoleUpdate(userId: string, workspaceId: string, workspaceName: string, newRole: string): Promise<void> {
        try {
            await this.createNotification({
                userId,
                type: 'workspaceRoleUpdate',
                title: 'Role Updated',
                message: `Your role in "${workspaceName}" has been changed to ${newRole}`,
                workspaceId,
                metadata: { newRole },
            });
        } catch (error) {
            logger.error('Error creating role update notification', error);
        }
    }

    /**
     * Format time until event
     */
    private formatTimeUntil(date: Date): string {
        const now = new Date();
        const diffMs = date.getTime() - now.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'now';
        if (diffMins < 60) return `in ${diffMins} minute${diffMins !== 1 ? 's' : ''}`;
        if (diffHours < 24) return `in ${diffHours} hour${diffHours !== 1 ? 's' : ''}`;
        return `in ${diffDays} day${diffDays !== 1 ? 's' : ''}`;
    }
}

export const notificationService = new NotificationService();
