import * as cron from 'node-cron';
import { reminderService } from '../services/reminderService';
import { logger } from '../utils/logger';

export class ReminderWorker {
    private task: ReturnType<typeof cron.schedule> | null = null;

    /**
     * Start the reminder worker
     * Runs every minute to process pending reminders
     */
    start(): void {
        if (this.task) {
            logger.warn('Reminder worker already running');
            return;
        }

        logger.section('⏰ REMINDER WORKER');

        // Run every minute
        this.task = cron.schedule('* * * * *', async () => {
            try {
                const count = await reminderService.processPendingReminders();

                if (count > 0) {
                    logger.success(`✓ Processed ${count} reminders`);
                }
            } catch (error) {
                logger.error('Error in reminder worker', error);
            }
        });

        logger.success('✅ Reminder worker started (runs every minute)');
    }

    /**
     * Stop the reminder worker
     */
    stop(): void {
        if (this.task) {
            this.task.stop();
            this.task = null;
            logger.info('Reminder worker stopped');
        }
    }

    /**
     * Check if worker is running
     */
    isRunning(): boolean {
        return this.task !== null;
    }
}

export const reminderWorker = new ReminderWorker();
