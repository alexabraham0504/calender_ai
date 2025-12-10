import { db } from '../config/firebase';
import { logger } from '../utils/logger';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { notificationService } from './notificationService';
import { emailService } from './emailService';

export interface Reminder {
    id?: string;
    eventId: string;
    userId: string;
    workspaceId?: string;
    eventTitle: string;
    eventStartTime: Timestamp;
    triggerTime: Timestamp;
    minutesBefore: number;
    delivered: boolean;
    channels: ('app' | 'email')[];
    createdAt: Timestamp;
}

export interface ReminderSettings {
    defaultReminderMinutes: number;
    enableEmail: boolean;
    enableInApp: boolean;
}

export class ReminderService {
    private collection = db.collection('reminders');
    private userSettingsCollection = db.collection('userSettings');

    /**
     * Get user's reminder settings
     */
    async getUserReminderSettings(userId: string): Promise<ReminderSettings> {
        try {
            const doc = await this.userSettingsCollection.doc(userId).get();

            if (!doc.exists) {
                // Return defaults
                return {
                    defaultReminderMinutes: 15,
                    enableEmail: false,
                    enableInApp: true,
                };
            }

            const data = doc.data();
            return {
                defaultReminderMinutes: data?.defaultReminderMinutes || 15,
                enableEmail: data?.enableEmail || false,
                enableInApp: data?.enableInApp !== false, // default true
            };
        } catch (error) {
            logger.error('Error fetching reminder settings', error);
            return {
                defaultReminderMinutes: 15,
                enableEmail: false,
                enableInApp: true,
            };
        }
    }

    /**
     * Schedule reminder for an event
     */
    async scheduleReminder(
        eventId: string,
        userId: string,
        eventTitle: string,
        eventStartTime: Date,
        minutesBefore?: number,
        workspaceId?: string
    ): Promise<string> {
        try {
            const settings = await this.getUserReminderSettings(userId);
            const reminderMinutes = minutesBefore || settings.defaultReminderMinutes;

            // Calculate trigger time
            const triggerTime = new Date(eventStartTime.getTime() - reminderMinutes * 60 * 1000);

            // Don't schedule if trigger time is in the past
            if (triggerTime < new Date()) {
                logger.info('Reminder trigger time is in the past, skipping', {
                    eventId,
                    triggerTime,
                });
                return '';
            }

            // Check for existing reminder
            const existing = await this.collection
                .where('eventId', '==', eventId)
                .where('userId', '==', userId)
                .where('minutesBefore', '==', reminderMinutes)
                .limit(1)
                .get();

            if (!existing.empty) {
                logger.info('Reminder already exists', { eventId, userId });
                return existing.docs[0].id;
            }

            // Determine channels
            const channels: ('app' | 'email')[] = [];
            if (settings.enableInApp) channels.push('app');
            if (settings.enableEmail) channels.push('email');

            const docRef = await this.collection.add({
                eventId,
                userId,
                workspaceId,
                eventTitle,
                eventStartTime: Timestamp.fromDate(eventStartTime),
                triggerTime: Timestamp.fromDate(triggerTime),
                minutesBefore: reminderMinutes,
                delivered: false,
                channels,
                createdAt: FieldValue.serverTimestamp(),
            });

            logger.success('Reminder scheduled', {
                reminderId: docRef.id,
                eventId,
                userId,
                triggerTime,
            });

            return docRef.id;
        } catch (error) {
            logger.error('Error scheduling reminder', error);
            throw error;
        }
    }

    /**
     * Schedule reminders for multiple users (workspace events)
     */
    async scheduleRemindersForWorkspace(
        eventId: string,
        userIds: string[],
        eventTitle: string,
        eventStartTime: Date,
        workspaceId: string
    ): Promise<void> {
        try {
            const promises = userIds.map(userId =>
                this.scheduleReminder(eventId, userId, eventTitle, eventStartTime, undefined, workspaceId)
            );

            await Promise.all(promises);

            logger.success('Workspace reminders scheduled', {
                eventId,
                workspaceId,
                userCount: userIds.length,
            });
        } catch (error) {
            logger.error('Error scheduling workspace reminders', error);
            throw error;
        }
    }

    /**
     * Process pending reminders (called by worker)
     */
    async processPendingReminders(): Promise<number> {
        try {
            const now = Timestamp.now();
            const oneMinuteLater = Timestamp.fromDate(new Date(Date.now() + 60 * 1000));

            // Find reminders that should trigger in the next minute and haven't been delivered
            const snapshot = await this.collection
                .where('delivered', '==', false)
                .where('triggerTime', '<=', oneMinuteLater)
                .where('triggerTime', '>', now)
                .get();

            if (snapshot.empty) {
                return 0;
            }

            logger.info(`Processing ${snapshot.size} pending reminders`);

            const batch = db.batch();
            const deliveryPromises: Promise<void>[] = [];

            snapshot.docs.forEach((doc: any) => {
                const reminder = { id: doc.id, ...doc.data() } as Reminder;

                // Deliver reminder
                deliveryPromises.push(this.deliverReminder(reminder));

                // Mark as delivered
                batch.update(doc.ref, { delivered: true });
            });

            // Execute deliveries and batch update
            await Promise.all([
                ...deliveryPromises,
                batch.commit(),
            ]);

            logger.success(`Processed ${snapshot.size} reminders`);
            return snapshot.size;
        } catch (error) {
            logger.error('Error processing pending reminders', error);
            return 0;
        }
    }

    /**
     * Deliver a reminder through configured channels
     */
    private async deliverReminder(reminder: Reminder): Promise<void> {
        try {
            const eventStartTime = reminder.eventStartTime.toDate();

            // In-app notification
            if (reminder.channels.includes('app')) {
                await notificationService.notifyEventReminder(
                    reminder.eventId,
                    reminder.userId,
                    reminder.eventTitle,
                    eventStartTime
                );
            }

            // Email notification
            if (reminder.channels.includes('email')) {
                // Get user email from Firebase Auth
                const userDoc = await db.collection('users').doc(reminder.userId).get();
                const userData = userDoc.data();
                const userEmail = userData?.email;

                if (userEmail) {
                    await emailService.sendEventReminder(
                        userEmail,
                        reminder.eventTitle,
                        eventStartTime,
                        reminder.minutesBefore
                    );
                }
            }

            logger.success('Reminder delivered', {
                reminderId: reminder.id,
                eventId: reminder.eventId,
                channels: reminder.channels,
            });
        } catch (error) {
            logger.error('Error delivering reminder', error);
            // Don't throw - we want to continue processing other reminders
        }
    }

    /**
     * Cancel all reminders for an event
     */
    async cancelRemindersByEvent(eventId: string): Promise<number> {
        try {
            const snapshot = await this.collection
                .where('eventId', '==', eventId)
                .where('delivered', '==', false)
                .get();

            if (snapshot.empty) {
                return 0;
            }

            const batch = db.batch();
            snapshot.docs.forEach((doc: any) => {
                batch.delete(doc.ref);
            });

            await batch.commit();

            logger.success('Reminders cancelled', { eventId, count: snapshot.size });
            return snapshot.size;
        } catch (error) {
            logger.error('Error cancelling reminders', error);
            return 0;
        }
    }

    /**
     * Update reminders when event time changes
     */
    async updateRemindersForEvent(
        eventId: string,
        newStartTime: Date,
        eventTitle: string
    ): Promise<void> {
        try {
            // Get all undelivered reminders
            const snapshot = await this.collection
                .where('eventId', '==', eventId)
                .where('delivered', '==', false)
                .get();

            if (snapshot.empty) {
                return;
            }

            const batch = db.batch();

            snapshot.docs.forEach((doc: any) => {
                const reminder = doc.data() as Reminder;
                const newTriggerTime = new Date(
                    newStartTime.getTime() - reminder.minutesBefore * 60 * 1000
                );

                // Update if trigger time is still in the future
                if (newTriggerTime > new Date()) {
                    batch.update(doc.ref, {
                        eventStartTime: Timestamp.fromDate(newStartTime),
                        triggerTime: Timestamp.fromDate(newTriggerTime),
                        eventTitle,
                    });
                } else {
                    // Delete if trigger time is in the past
                    batch.delete(doc.ref);
                }
            });

            await batch.commit();

            logger.success('Reminders updated for event', { eventId });
        } catch (error) {
            logger.error('Error updating reminders', error);
            throw error;
        }
    }

    /**
     * Get user's upcoming reminders
     */
    async getUserReminders(userId: string, limit: number = 10): Promise<Reminder[]> {
        try {
            const snapshot = await this.collection
                .where('userId', '==', userId)
                .where('delivered', '==', false)
                .orderBy('triggerTime', 'asc')
                .limit(limit)
                .get();

            return snapshot.docs.map((doc: any) => ({
                id: doc.id,
                ...doc.data(),
            })) as Reminder[];
        } catch (error) {
            logger.error('Error fetching user reminders', error);
            return [];
        }
    }

    /**
     * Delete a specific reminder
     */
    async deleteReminder(reminderId: string, userId: string): Promise<void> {
        try {
            const docRef = this.collection.doc(reminderId);
            const doc = await docRef.get();

            if (!doc.exists) {
                throw new Error('Reminder not found');
            }

            const data = doc.data();
            if (data?.userId !== userId) {
                throw new Error('Unauthorized');
            }

            await docRef.delete();

            logger.success('Reminder deleted', { reminderId });
        } catch (error) {
            logger.error('Error deleting reminder', error);
            throw error;
        }
    }
}

export const reminderService = new ReminderService();
