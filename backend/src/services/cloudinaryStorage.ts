/**
 * @fileoverview Cloudinary Storage Service for Calendar Images
 * @module services/cloudinaryStorage
 * 
 * Provides wrapper functions around Cloudinary SDK for:
 * - Uploading images to Cloudinary
 * - Generating public URLs
 * - Deleting images
 * - Managing cloud storage
 * 
 * Storage structure: calendar-images/{userId}/{imageId}
 * 
 * Usage:
 *   import { uploadImageToCloudinary, deleteImageFromCloudinary } from './cloudinaryStorage';
 *   const url = await uploadImageToCloudinary(buffer, userId, imageId, filename);
 */

import { v2 as cloudinary } from 'cloudinary';
import { logger } from '../utils/logger';

// Log environment variable status for debugging
logger.info('Cloudinary env vars check:', {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME ? '✓ Set' : '✗ Missing',
    apiKey: process.env.CLOUDINARY_API_KEY ? '✓ Set' : '✗ Missing',
    apiSecret: process.env.CLOUDINARY_API_SECRET ? '✓ Set' : '✗ Missing',
});

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Log successful configuration
logger.info('Cloudinary configured with cloud_name:', process.env.CLOUDINARY_CLOUD_NAME);

/**
 * Upload image buffer to Cloudinary
 * 
 * @param buffer - Image file buffer
 * @param userId - User ID for organizing storage
 * @param imageId - Unique image identifier
 * @param filename - Original filename
 * @returns Public URL
 */
export async function uploadImageToCloudinary(
    buffer: Buffer,
    userId: string,
    imageId: string,
    filename: string
): Promise<string> {
    try {
        logger.info('Starting Cloudinary upload', { userId, imageId, filename, bufferSize: buffer.length });

        // Convert buffer to base64
        const base64Image = `data:image/jpeg;base64,${buffer.toString('base64')}`;

        // Upload to Cloudinary
        const result = await cloudinary.uploader.upload(base64Image, {
            public_id: `calendar-images/${userId}/${imageId}`,
            folder: 'calendar-images',
            resource_type: 'image',
            overwrite: true,
            invalidate: true,
        });

        logger.info('Image uploaded successfully to Cloudinary:', result.secure_url);

        return result.secure_url;
    } catch (error: any) {
        logger.error('Error uploading image to Cloudinary:', {
            message: error.message,
            code: error.code,
            stack: error.stack,
            name: error.name,
        });
        throw new Error(`Failed to upload image to Cloudinary: ${error.message}`);
    }
}

/**
 * Delete image from Cloudinary
 * 
 * @param userId - User ID
 * @param imageId - Image ID
 */
export async function deleteImageFromCloudinary(userId: string, imageId: string): Promise<void> {
    try {
        const publicId = `calendar-images/${userId}/${imageId}`;

        await cloudinary.uploader.destroy(publicId);

        logger.info(`Image deleted from Cloudinary: ${publicId}`);
    } catch (error: any) {
        if (error.http_code === 404) {
            logger.warn(`Image not found in Cloudinary: ${userId}/${imageId}`);
            return; // File doesn't exist, consider it successful
        }
        logger.error('Error deleting image from Cloudinary:', error);
        throw new Error('Failed to delete image from Cloudinary');
    }
}

/**
 * Delete all sizes of an image from Cloudinary
 * 
 * @param userId - User ID
 * @param imageId - Image ID
 */
export async function deleteAllImageSizes(userId: string, imageId: string): Promise<void> {
    // Cloudinary handles transformations dynamically, so we only need to delete the original
    await deleteImageFromCloudinary(userId, imageId);
    logger.info(`Deleted image ${imageId} from Cloudinary`);
}

/**
 * Get optimized URL with transformations
 * 
 * @param publicId - Cloudinary public ID
 * @param transformation - Transformation options
 * @returns Optimized URL
 */
export function getOptimizedUrl(
    publicId: string,
    transformation?: { width?: number; height?: number; quality?: string; crop?: string }
): string {
    return cloudinary.url(publicId, {
        transformation: [
            {
                width: transformation?.width || 1200,
                height: transformation?.height,
                crop: transformation?.crop || 'limit',
                quality: transformation?.quality || 'auto',
                fetch_format: 'auto',
            },
        ],
    });
}

/**
 * Check if Cloudinary is properly configured
 */
export function isCloudinaryConfigured(): boolean {
    const config = cloudinary.config();
    return !!(config.cloud_name && config.api_key && config.api_secret);
}
