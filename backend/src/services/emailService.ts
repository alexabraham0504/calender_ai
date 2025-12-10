import nodemailer from 'nodemailer';
import { logger } from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';

export interface EmailConfig {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
    from: string;
}

export class EmailService {
    private transporter: nodemailer.Transporter | null = null;
    private enabled: boolean = false;
    private config: EmailConfig;

    constructor() {
        this.config = {
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: process.env.SMTP_SECURE === 'true',
            user: process.env.SMTP_USER || '',
            pass: process.env.SMTP_PASS || '',
            from: process.env.SMTP_FROM || 'Calendar AI <noreply@calendarai.com>',
        };

        this.initialize();
    }

    private async initialize(): Promise<void> {
        try {
            if (!this.config.user || !this.config.pass) {
                logger.warn('Email service disabled: SMTP credentials not configured');
                this.enabled = false;
                return;
            }

            this.transporter = nodemailer.createTransport({
                host: this.config.host,
                port: this.config.port,
                secure: this.config.secure,
                auth: {
                    user: this.config.user,
                    pass: this.config.pass,
                },
            });

            // Verify connection
            await this.transporter.verify();
            this.enabled = true;
            logger.success('Email service initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize email service', error);
            this.enabled = false;
        }
    }

    /**
     * Load HTML template
     */
    private loadTemplate(templateName: string): string {
        try {
            const templatePath = path.join(__dirname, '../email/templates', `${templateName}.html`);
            return fs.readFileSync(templatePath, 'utf-8');
        } catch (error) {
            logger.error(`Error loading email template: ${templateName}`, error);
            return '';
        }
    }

    /**
     * Replace placeholders in template
     */
    private replacePlaceholders(template: string, data: Record<string, string>): string {
        let result = template;
        Object.keys(data).forEach(key => {
            const regex = new RegExp(`{{${key}}}`, 'g');
            result = result.replace(regex, data[key]);
        });
        return result;
    }

    /**
     * Send email
     */
    private async sendEmail(
        to: string,
        subject: string,
        html: string,
        text?: string
    ): Promise<boolean> {
        if (!this.enabled || !this.transporter) {
            logger.warn('Email service not available');
            return false;
        }

        try {
            const info = await this.transporter.sendMail({
                from: this.config.from,
                to,
                subject,
                html,
                text: text || html.replace(/<[^>]*>/g, ''), // Strip HTML for text version
            });

            logger.success('Email sent successfully', {
                to,
                subject,
                messageId: info.messageId,
            });

            return true;
        } catch (error) {
            logger.error('Error sending email', error);
            return false;
        }
    }

    /**
     * Send event reminder email
     */
    async sendEventReminder(
        to: string,
        eventTitle: string,
        eventStartTime: Date,
        minutesBefore: number
    ): Promise<boolean> {
        try {
            const template = this.loadTemplate('eventReminder');
            if (!template) {
                return false;
            }

            const formattedDate = eventStartTime.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
            });

            const formattedTime = eventStartTime.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
            });

            const timeUntil = this.formatTimeUntil(eventStartTime, minutesBefore);

            const html = this.replacePlaceholders(template, {
                eventTitle,
                eventDate: formattedDate,
                eventTime: formattedTime,
                timeUntil,
                minutesBefore: minutesBefore.toString(),
            });

            return await this.sendEmail(
                to,
                `⏰ Reminder: ${eventTitle}`,
                html
            );
        } catch (error) {
            logger.error('Error sending event reminder email', error);
            return false;
        }
    }

    /**
     * Send event created notification
     */
    async sendEventCreated(
        to: string,
        eventTitle: string,
        eventStartTime: Date,
        createdBy: string
    ): Promise<boolean> {
        try {
            const formattedDate = eventStartTime.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
            });

            const formattedTime = eventStartTime.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
            });

            const html = `
                <h2>New Event Created</h2>
                <p><strong>${createdBy}</strong> created a new event:</p>
                <p><strong>${eventTitle}</strong></p>
                <p>Date: ${formattedDate}</p>
                <p>Time: ${formattedTime}</p>
            `;

            return await this.sendEmail(
                to,
                `New Event: ${eventTitle}`,
                html
            );
        } catch (error) {
            logger.error('Error sending event created email', error);
            return false;
        }
    }

    /**
     * Send workspace invite email
     */
    async sendWorkspaceInvite(
        to: string,
        workspaceName: string,
        invitedBy: string,
        joinCode: string
    ): Promise<boolean> {
        try {
            const template = this.loadTemplate('workspaceInvite');
            if (!template) {
                return false;
            }

            const html = this.replacePlaceholders(template, {
                workspaceName,
                invitedBy,
                joinCode,
                appUrl: process.env.FRONTEND_URL || 'http://localhost:4321',
            });

            return await this.sendEmail(
                to,
                `You've been invited to ${workspaceName}`,
                html
            );
        } catch (error) {
            logger.error('Error sending workspace invite email', error);
            return false;
        }
    }

    /**
     * Send event updated notification
     */
    async sendEventUpdated(
        to: string,
        eventTitle: string,
        changes: string[]
    ): Promise<boolean> {
        try {
            const changesList = changes.map(change => `<li>${change}</li>`).join('');

            const html = `
                <h2>Event Updated</h2>
                <p>The event <strong>${eventTitle}</strong> has been updated.</p>
                <p><strong>Changes:</strong></p>
                <ul>${changesList}</ul>
            `;

            return await this.sendEmail(
                to,
                `Event Updated: ${eventTitle}`,
                html
            );
        } catch (error) {
            logger.error('Error sending event updated email', error);
            return false;
        }
    }

    /**
     * Send daily agenda summary
     */
    async sendDailyAgenda(
        to: string,
        events: Array<{ title: string; startTime: Date; endTime: Date }>
    ): Promise<boolean> {
        try {
            const today = new Date().toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
            });

            const eventsList = events.map(event => {
                const startTime = event.startTime.toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                });
                const endTime = event.endTime.toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                });

                return `<li><strong>${event.title}</strong> - ${startTime} to ${endTime}</li>`;
            }).join('');

            const html = `
                <h2>Your Agenda for ${today}</h2>
                <p>You have ${events.length} event${events.length !== 1 ? 's' : ''} scheduled today:</p>
                <ul>${eventsList}</ul>
            `;

            return await this.sendEmail(
                to,
                `Your Agenda for ${today}`,
                html
            );
        } catch (error) {
            logger.error('Error sending daily agenda email', error);
            return false;
        }
    }

    /**
     * Format time until event
     */
    private formatTimeUntil(eventTime: Date, minutesBefore: number): string {
        const diffMs = eventTime.getTime() - new Date().getTime();
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 60) {
            return `in ${diffMins} minutes`;
        } else if (diffMins < 1440) {
            const hours = Math.floor(diffMins / 60);
            return `in ${hours} hour${hours !== 1 ? 's' : ''}`;
        } else {
            const days = Math.floor(diffMins / 1440);
            return `in ${days} day${days !== 1 ? 's' : ''}`;
        }
    }

    /**
     * Test email configuration
     */
    async testConnection(): Promise<boolean> {
        if (!this.enabled || !this.transporter) {
            logger.warn('Email service not configured');
            return false;
        }

        try {
            await this.transporter.verify();
            logger.success('Email service connection test successful');
            return true;
        } catch (error) {
            logger.error('Email service connection test failed', error);
            return false;
        }
    }
}

export const emailService = new EmailService();
