/**
 * Request/Response Logging Middleware
 * Logs all incoming requests and outgoing responses with detailed information
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();

    // Log incoming request
    logger.separator();
    logger.info(`📥 INCOMING REQUEST`, {
        method: req.method,
        url: req.url,
        path: req.path,
        query: req.query,
        headers: {
            'content-type': req.headers['content-type'],
            'authorization': req.headers.authorization ? 'Bearer [REDACTED]' : 'None',
            'user-agent': req.headers['user-agent'],
        },
        body: req.body && Object.keys(req.body).length > 0 ? req.body : undefined,
        ip: req.ip,
    });

    // Capture the original res.json to log response
    const originalJson = res.json.bind(res);
    res.json = function (body: any) {
        const duration = Date.now() - startTime;

        logger.info(`📤 OUTGOING RESPONSE`, {
            method: req.method,
            url: req.url,
            statusCode: res.statusCode,
            duration: `${duration}ms`,
            body: body,
        });

        if (res.statusCode >= 200 && res.statusCode < 300) {
            logger.success(`✅ Request completed successfully in ${duration}ms`);
        } else if (res.statusCode >= 400) {
            logger.error(`❌ Request failed with status ${res.statusCode}`);
        }

        logger.separator();

        return originalJson(body);
    };

    // Capture response finish event for non-JSON responses
    res.on('finish', () => {
        if (!res.headersSent) {
            const duration = Date.now() - startTime;
            logger.http(req.method, req.url, res.statusCode, duration);
        }
    });

    next();
};

// Error logging middleware
export const errorLogger = (err: any, req: Request, res: Response, next: NextFunction) => {
    logger.separator();
    logger.error(`💥 ERROR OCCURRED`, {
        message: err.message,
        stack: err.stack,
        method: req.method,
        url: req.url,
        body: req.body,
        query: req.query,
        params: req.params,
    });
    logger.separator();

    next(err);
};
