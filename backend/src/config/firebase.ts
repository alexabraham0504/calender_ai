import admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

// We'll import logger after Firebase is initialized to avoid circular dependencies
let logger: any;

// Initialize Firebase Admin
const initializeFirebase = () => {
    // Import logger here to avoid circular dependency
    try {
        logger = require('../utils/logger').logger;
    } catch (e) {
        // Logger not available yet, will use console
    }

    const logInfo = (msg: string) => {
        if (logger) {
            logger.info(msg);
        } else {
            console.log(`[INFO] ${msg}`);
        }
    };

    const logSuccess = (msg: string) => {
        if (logger) {
            logger.success(msg);
        } else {
            console.log(`[SUCCESS] ${msg}`);
        }
    };

    const logError = (msg: string, error?: any) => {
        if (logger) {
            logger.error(msg, error);
        } else {
            console.error(`[ERROR] ${msg}`, error || '');
        }
    };

    if (admin.apps.length) {
        return;
    }

    try {
        logInfo('🔥 Initializing Firebase...');

        // Load service account
        const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
            ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
            : require('../../serviceAccountKey.json');

        // Initialize Firebase Admin
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
        });

        // Configure Firestore
        const firestore = admin.firestore();
        firestore.settings({ ignoreUndefinedProperties: true });

        logSuccess(`✅ Firebase connected (${serviceAccount.project_id})`);

        // Test connection asynchronously (don't block startup)
        firestore.listCollections()
            .then((collections) => {
                if (logger) {
                    logger.debug(`Firestore collections: ${collections.map(c => c.id).join(', ') || 'none'}`);
                }
            })
            .catch(() => {
                // Silently fail - connection will be tested on first use
            });

    } catch (error: any) {
        logError('❌ Firebase initialization failed', error);

        console.error('\n\x1b[31m%s\x1b[0m', '═════════════════════════════════════════════════════════');
        console.error('\x1b[31m%s\x1b[0m', '❌ ERROR: Failed to initialize Firebase Admin SDK');
        console.error('\x1b[31m%s\x1b[0m', '═════════════════════════════════════════════════════════');
        console.error('\x1b[33m%s\x1b[0m', '\nPossible causes:');
        console.error('\x1b[33m%s\x1b[0m', '1. Invalid serviceAccountKey.json file');
        console.error('\x1b[33m%s\x1b[0m', '2. Missing or incorrect Firebase credentials');
        console.error('\x1b[33m%s\x1b[0m', '\nHow to fix:');
        console.error('\x1b[32m%s\x1b[0m', '1. Go to Firebase Console → Project Settings → Service Accounts');
        console.error('\x1b[32m%s\x1b[0m', '2. Click "Generate New Private Key"');
        console.error('\x1b[32m%s\x1b[0m', '3. Save the file as backend/serviceAccountKey.json');
        console.error('\x1b[31m%s\x1b[0m', '═════════════════════════════════════════════════════════\n');

        throw error;
    }
};

// Initialize Firebase
initializeFirebase();

// Export Firestore and Auth instances
export const db = admin.firestore();
export const auth = admin.auth();
