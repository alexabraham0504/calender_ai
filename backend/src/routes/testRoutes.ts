import { Router } from 'express';
import { emailService } from '../services/emailService';
import { protect as authenticate, AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

/**
 * Simple test email endpoint (NO AUTH REQUIRED)
 * GET /api/test/email/send
 */
router.get('/email/send', async (req, res) => {
    try {
        const userEmail = 'alexyabraham05@gmail.com';

        logger.info('Sending test email (public endpoint)', { to: userEmail });

        // Send a simple test email
        const testEvent = {
            title: 'Test Event - Email Verification',
            startTime: new Date(Date.now() + 15 * 60000), // 15 minutes from now
            minutesBefore: 15
        };

        const success = await emailService.sendEventReminder(
            userEmail,
            testEvent.title,
            testEvent.startTime,
            testEvent.minutesBefore
        );

        if (success) {
            logger.success('Test email sent successfully', { to: userEmail });
            res.send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Email Test Success</title>
                    <style>
                        body {
                            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                            max-width: 600px;
                            margin: 50px auto;
                            padding: 40px;
                            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                            min-height: 100vh;
                        }
                        .card {
                            background: white;
                            padding: 40px;
                            border-radius: 20px;
                            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                        }
                        h1 { color: #10b981; margin: 0 0 20px 0; }
                        .success { font-size: 60px; text-align: center; }
                        p { color: #374151; line-height: 1.6; }
                        .email { 
                            background: #f3f4f6; 
                            padding: 15px; 
                            border-radius: 8px; 
                            font-family: monospace;
                            margin: 20px 0;
                        }
                        .button {
                            display: inline-block;
                            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                            color: white;
                            padding: 15px 30px;
                            text-decoration: none;
                            border-radius: 10px;
                            margin-top: 20px;
                            font-weight: 600;
                        }
                        .steps {
                            background: #eff6ff;
                            padding: 20px;
                            border-radius: 10px;
                            border-left: 4px solid #3b82f6;
                            margin: 20px 0;
                        }
                        .steps ol { margin: 10px 0; padding-left: 20px; }
                        .steps li { margin: 5px 0; color: #1e40af; }
                    </style>
                </head>
                <body>
                    <div class="card">
                        <div class="success">✅</div>
                        <h1>Test Email Sent Successfully!</h1>
                        <p>A beautiful reminder email has been sent to:</p>
                        <div class="email">
                            📧 ${userEmail}
                        </div>
                        
                        <div class="steps">
                            <strong>📬 Next Steps:</strong>
                            <ol>
                                <li>Open Gmail: <a href="https://mail.google.com" target="_blank">mail.google.com</a></li>
                                <li>Look for email: <strong>"⏰ Reminder: Test Event - Email Verification"</strong></li>
                                <li>Check spam folder if not in inbox</li>
                                <li>Enjoy the beautiful design! ✨</li>
                            </ol>
                        </div>

                        <p><strong>Email Details:</strong></p>
                        <ul>
                            <li>Subject: ⏰ Reminder: ${testEvent.title}</li>
                            <li>Time: ${testEvent.startTime.toLocaleString()}</li>
                            <li>Features: Gradient header, alert banner, styled cards, CTA button</li>
                        </ul>

                        <center>
                            <a href="http://localhost:4321" class="button">← Back to Calendar</a>
                            <a href="/api/test/email/send" class="button">🔄 Send Another Test</a>
                        </center>
                    </div>
                </body>
                </html>
            `);
        } else {
            logger.error('Failed to send test email');
            res.status(500).send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Email Test Failed</title>
                    <style>
                        body {
                            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                            max-width: 600px;
                            margin: 50px auto;
                            padding: 40px;
                            background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
                            min-height: 100vh;
                        }
                        .card {
                            background: white;
                            padding: 40px;
                            border-radius: 20px;
                            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                        }
                        h1 { color: #dc2626; margin: 0 0 20px 0; }
                        .error { font-size: 60px; text-align: center; }
                        p { color: #374151; line-height: 1.6; }
                        .warning {
                            background: #fef3c7;
                            padding: 15px;
                            border-radius: 8px;
                            border-left: 4px solid #f59e0b;
                            margin: 20px 0;
                        }
                    </style>
                </head>
                <body>
                    <div class="card">
                        <div class="error">❌</div>
                        <h1>Failed to Send Email</h1>
                        <p>The email service encountered an error.</p>
                        
                        <div class="warning">
                            <strong>⚠️ Common Issues:</strong>
                            <ul>
                                <li>SMTP credentials not configured</li>
                                <li>Invalid Gmail App Password</li>
                                <li>Email service not initialized</li>
                            </ul>
                        </div>

                        <p>Check the backend logs for more details.</p>
                    </div>
                </body>
                </html>
            `);
        }
    } catch (error) {
        logger.error('Error in test email endpoint', error);
        res.status(500).send(`
            <h1>Error</h1>
            <p>Something went wrong: ${error instanceof Error ? error.message : 'Unknown error'}</p>
        `);
    }
});

/**
 * Test email endpoint (requires auth)
 * GET /api/test/email
 */
router.get('/email', authenticate, async (req: AuthRequest, res) => {
    try {
        const user = req.user as any;
        const userEmail = user.email || 'alexyabraham05@gmail.com';

        logger.info('Sending test email', { to: userEmail });

        const testEvent = {
            title: 'Test Event - Email Verification',
            startTime: new Date(Date.now() + 15 * 60000),
            minutesBefore: 15
        };

        const success = await emailService.sendEventReminder(
            userEmail,
            testEvent.title,
            testEvent.startTime,
            testEvent.minutesBefore
        );

        if (success) {
            logger.success('Test email sent successfully', { to: userEmail });
            res.json({
                success: true,
                message: `Test email sent successfully to ${userEmail}`,
                details: {
                    to: userEmail,
                    subject: `Reminder: ${testEvent.title}`,
                    time: testEvent.startTime.toISOString()
                }
            });
        } else {
            logger.error('Failed to send test email');
            res.status(500).json({
                success: false,
                message: 'Failed to send test email. Check backend logs for details.',
                hint: 'Email service may not be configured or SMTP credentials may be invalid'
            });
        }
    } catch (error) {
        logger.error('Error in test email endpoint', error);
        res.status(500).json({
            success: false,
            message: 'Error sending test email',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * Test email connection
 * GET /api/test/email/connection
 */
router.get('/email/connection', authenticate, async (req: AuthRequest, res) => {
    try {
        const isConnected = await emailService.testConnection();

        res.json({
            success: isConnected,
            message: isConnected
                ? 'Email service is properly configured and connected!'
                : 'Email service connection test failed. Check SMTP credentials.',
            config: {
                host: process.env.SMTP_HOST,
                port: process.env.SMTP_PORT,
                user: process.env.SMTP_USER,
                from: process.env.SMTP_FROM
            }
        });
    } catch (error) {
        logger.error('Error testing email connection', error);
        res.status(500).json({
            success: false,
            message: 'Error testing email connection',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

export default router;
