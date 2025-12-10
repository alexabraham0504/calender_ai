import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import eventRoutes from './routes/eventRoutes';
import settingsRoutes from './routes/settingsRoutes';
import workspaceRoutes from './routes/workspaceRoutes';
import roleRoutes from './routes/roleRoutes';
import inviteRoutes from './routes/inviteRoutes';
import aiRoutes from './routes/aiRoutes';
import { logger } from './utils/logger';
import { requestLogger, errorLogger } from './middleware/requestLogger';

dotenv.config();

logger.section('🚀 SERVER START'); // Starting server

const app = express();

logger.info(`Env: ${process.env.NODE_ENV || 'dev'} | Port: ${process.env.PORT || 5000}`);

app.use(cors());
logger.debug('✓ CORS');

app.use(express.json());
logger.debug('✓ JSON');

app.use(requestLogger);
logger.debug('✓ Logger');

app.use('/api/events', eventRoutes);
logger.debug('✓ /api/events');

app.use('/api/settings', settingsRoutes);
logger.debug('✓ /api/settings');

app.use('/api/workspaces', workspaceRoutes);
logger.debug('✓ /api/workspaces');

app.use('/api/workspaces/roles', roleRoutes);
logger.debug('✓ /api/workspaces/roles');

app.use('/api/workspaces/invite', inviteRoutes);
logger.debug('✓ /api/workspaces/invite');

app.use('/api/ai', aiRoutes);
logger.debug('✓ /api/ai');

app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString(), uptime: process.uptime() });
});
logger.debug('✓ /health');

app.use(errorLogger);

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.error('Error', err);
    res.status(err.status || 500).json({
        message: err.message || 'Something went wrong!',
        stack: process.env.NODE_ENV === 'production' ? null : err.stack,
    });
});

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
    logger.separator();
    logger.success(`✅ Ready on :${PORT}`);
    logger.info(`http://localhost:${PORT}`);
    logger.separator();
});

process.on('SIGTERM', () => {
    logger.warn('Shutting down...');
    server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
    logger.warn('\nShutting down...');
    server.close(() => process.exit(0));
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection', { promise, reason });
});

process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception', error);
    process.exit(1);
});
