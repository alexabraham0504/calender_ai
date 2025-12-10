import { Request, Response, NextFunction } from 'express';
import { auth } from '../config/firebase';
import { logger } from '../utils/logger';

export interface AuthRequest extends Request {
    user?: any;
}

export const protect = async (req: AuthRequest, res: Response, next: NextFunction) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];

            logger.debug('Verifying authentication token...');
            const decodedToken = await auth.verifyIdToken(token);
            req.user = decodedToken;

            logger.success(`User authenticated: ${decodedToken.uid}`);
            next();
        } catch (error) {
            logger.error('Token verification failed', error);
            res.status(401).json({ message: 'Not authorized, token failed', error: (error as Error).message });
        }
    } else {
        logger.warn('No authorization token provided in request');
        res.status(401).json({ message: 'Not authorized, no token' });
    }
};
