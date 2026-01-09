/**
 * @fileoverview Firebase Storage Service for Calendar Images
 * @module services/storageService
 * 
 * Provides wrapper functions around Firebase Admin Storage SDK for:
 * - Uploading images to Firebase Storage
 * - Generating signed/public URLs
 * - Deleting images
 * - Managing storage paths and metadata
 * 
 * Storage structure: calendar-images/{userId}/{imageId}.{ext}
 * 
 * Usage:
 *   import { uploadImageToStorage, deleteImageFromStorage } from './storageService';
 *   const url = await uploadImageToStorage(buffer, userId, imageId, contentType);
 */

import admin from 'firebase-admin';
import { logger } from '../utils/logger';

// Get storage bucket - use default bucket from Firebase Admin init
const bucket = admin.storage().bucket();

/**
 * Upload image buffer to Firebase Storage
 * 
 * @param buffer - Image file buffer
 * @param userId - User ID for organizing storage
 * @param imageId - Unique image identifier
 * @param contentType - MIME type (e.g., 'image/jpeg')
 * @param filename - Original filename
 * @returns Public download URL
 */
export async function uploadImageToStorage(
    buffer: Buffer,
    userId: string,
    imageId: string,
    contentType: string,
    filename: string
): Promise<string> {
    try {
        logger.info('Starting image upload', { userId, imageId, filename, bufferSize: buffer.length });

        const extension = filename.split('.').pop() || 'jpg';
        const storagePath = `calendar-images/${userId}/${imageId}.${extension}`;

        logger.info('Storage path:', storagePath);
        logger.info('Bucket name:', bucket.name);

        const file = bucket.file(storagePath);

        logger.info('Saving file to storage...');
        await file.save(buffer, {
            metadata: {
                contentType,
                metadata: {
                    firebaseStorageDownloadTokens: imageId,
                    originalName: filename,
                    uploadedBy: userId,
                    uploadedAt: new Date().toISOString(),
                },
            },
            public: true,
        });

        logger.info('File saved, making public...');
        // Make file publicly accessible
        await file.makePublic();

        // Get public URL
        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;

        logger.info(`Image uploaded successfully to storage: ${storagePath}`);

        return publicUrl;
    } catch (error: any) {
        logger.error('Error uploading image to storage:', {
            message: error.message,
            code: error.code,
            stack: error.stack,
            name: error.name,
            details: error.details
        });
        throw new Error(`Failed to upload image to storage: ${error.message}`);
    }
}

/**
 * Upload multiple image sizes (thumbnail, medium, original)
 * 
 * @param buffers - Object with different size buffers
 * @param userId - User ID
 * @param imageId - Image ID
 * @param contentType - MIME type
 * @param filename - Original filename
 * @returns URLs for each size
 */
export async function uploadMultipleSizes(
    buffers: { original: Buffer; medium?: Buffer; thumb?: Buffer },
    userId: string,
    imageId: string,
    contentType: string,
    filename: string
): Promise<{ original: string; medium?: string; thumb?: string }> {
    const extension = filename.split('.').pop() || 'jpg';
    const basePath = `calendar-images/${userId}/${imageId}`;

    const urls: { original: string; medium?: string; thumb?: string } = {
        original: '',
    };

    try {
        // Upload original
        urls.original = await uploadImageToStorage(
            buffers.original,
            userId,
            imageId,
            contentType,
            filename
        );

        // Upload medium if provided
        if (buffers.medium) {
            const mediumPath = `${basePath}_medium.${extension}`;
            const mediumFile = bucket.file(mediumPath);
            await mediumFile.save(buffers.medium, { metadata: { contentType }, public: true });
            await mediumFile.makePublic();
            urls.medium = `https://storage.googleapis.com/${bucket.name}/${mediumPath}`;
        }

        // Upload thumbnail if provided
        if (buffers.thumb) {
            const thumbPath = `${basePath}_thumb.${extension}`;
            const thumbFile = bucket.file(thumbPath);
            await thumbFile.save(buffers.thumb, { metadata: { contentType }, public: true });
            await thumbFile.makePublic();
            urls.thumb = `https://storage.googleapis.com/${bucket.name}/${thumbPath}`;
        }

        logger.info(`Uploaded ${Object.keys(buffers).length} sizes for image ${imageId}`);

        return urls;
    } catch (error) {
        logger.error('Error uploading multiple sizes:', error);
        throw error;
    }
}

/**
 * Delete image from Firebase Storage
 * 
 * @param storagePath - Full storage path of the file
 */
export async function deleteImageFromStorage(storagePath: string): Promise<void> {
    try {
        const file = bucket.file(storagePath);
        await file.delete();

        logger.info(`Image deleted from storage: ${storagePath}`);
    } catch (error: any) {
        if (error.code === 404) {
            logger.warn(`Image not found in storage: ${storagePath}`);
            return; // File doesn't exist, consider it successful
        }
        logger.error('Error deleting image from storage:', error);
        throw new Error('Failed to delete image from storage');
    }
}

/**
 * Delete all sizes of an image (original, medium, thumb)
 * 
 * @param userId - User ID
 * @param imageId - Image ID
 * @param extension - File extension
 */
export async function deleteAllImageSizes(
    userId: string,
    imageId: string,
    extension: string
): Promise<void> {
    const basePath = `calendar-images/${userId}/${imageId}`;

    const paths = [
        `${basePath}.${extension}`,
        `${basePath}_medium.${extension}`,
        `${basePath}_thumb.${extension}`,
    ];

    await Promise.allSettled(paths.map(path => deleteImageFromStorage(path)));

    logger.info(`Deleted all sizes for image ${imageId}`);
}

/**
 * Get signed URL for temporary access (if needed)
 * 
 * @param storagePath - Storage path
 * @param expiresInMinutes - Expiration time in minutes (default: 60)
 * @returns Signed URL
 */
export async function getSignedUrl(
    storagePath: string,
    expiresInMinutes: number = 60
): Promise<string> {
    try {
        const file = bucket.file(storagePath);
        const [url] = await file.getSignedUrl({
            action: 'read',
            expires: Date.now() + expiresInMinutes * 60 * 1000,
        });

        return url;
    } catch (error) {
        logger.error('Error generating signed URL:', error);
        throw new Error('Failed to generate signed URL');
    }
}

/**
 * Check if a file exists in storage
 * 
 * @param storagePath - Storage path
 * @returns True if file exists
 */
export async function fileExists(storagePath: string): Promise<boolean> {
    try {
        const file = bucket.file(storagePath);
        const [exists] = await file.exists();
        return exists;
    } catch (error) {
        logger.error('Error checking file existence:', error);
        return false;
    }
}
