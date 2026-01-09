/**
 * @fileoverview Image Processing Service using Sharp
 * @module services/imageService
 * 
 * Handles image upload, optimization, resizing, and metadata extraction.
 * Uses Sharp library for high-performance image processing.
 * 
 * Features:
 * - Upload validation (file type, size)
 * - Automatic resizing (original, medium, thumbnail)
 * - Format conversion and optimization
 * - Metadata extraction (dimensions, format, size)
 * - Integration with Firebase Storage
 * 
 * Usage:
 *   import { processAndUploadImage, deleteImage } from './imageService';
 *   const result = await processAndUploadImage(fileBuffer, filename, userId);
 */

import sharp from 'sharp';
import * as admin from 'firebase-admin';
import { db } from '../config/firebase';
import { uploadImageToCloudinary, deleteAllImageSizes } from './cloudinaryStorage';
import { ImageUploadResponse, CalendarImage } from '../types/image';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

const MAX_UPLOAD_SIZE_MB = parseInt(process.env.MAX_UPLOAD_MB || '10');
const MAX_UPLOAD_SIZE_BYTES = MAX_UPLOAD_SIZE_MB * 1024 * 1024;

// Supported image formats
const SUPPORTED_FORMATS = ['jpg', 'jpeg', 'png', 'webp', 'gif'];

/**
 * Validate uploaded file
 */
function validateImage(buffer: Buffer, filename: string): void {
    // Check file size
    if (buffer.length > MAX_UPLOAD_SIZE_BYTES) {
        throw new Error(`File size exceeds ${MAX_UPLOAD_SIZE_MB}MB limit`);
    }

    // Check file extension
    const extension = filename.split('.').pop()?.toLowerCase();
    if (!extension || !SUPPORTED_FORMATS.includes(extension)) {
        throw new Error(`Unsupported file format. Allowed: ${SUPPORTED_FORMATS.join(', ')}`);
    }
}

/**
 * Generate multiple sizes of an image
 */
async function generateImageSizes(buffer: Buffer): Promise<{
    original: Buffer;
    medium: Buffer;
    thumb: Buffer;
    metadata: any;
}> {
    const image = sharp(buffer);
    const metadata = await image.metadata();

    // Original (max 2000px on longest side)
    const originalBuffer = await image
        .resize(2000, 2000, {
            fit: 'inside',
            withoutEnlargement: true,
        })
        .jpeg({ quality: 90 })
        .toBuffer();

    // Medium (max 800px on longest side)
    const mediumBuffer = await sharp(buffer)
        .resize(800, 800, {
            fit: 'inside',
            withoutEnlargement: true,
        })
        .jpeg({ quality: 85 })
        .toBuffer();

    // Thumbnail (max 200px on longest side)
    const thumbBuffer = await sharp(buffer)
        .resize(200, 200, {
            fit: 'inside',
            withoutEnlargement: true,
        })
        .jpeg({ quality: 80 })
        .toBuffer();

    return {
        original: originalBuffer,
        medium: mediumBuffer,
        thumb: thumbBuffer,
        metadata,
    };
}

/**
 * Process and upload image to Firebase Storage and Firestore
 * 
 * @param buffer - File buffer
 * @param filename - Original filename
 * @param userId - User ID
 * @param workspaceId - Optional workspace ID
 * @returns Upload response with image ID and URL
 */
export async function processAndUploadImage(
    buffer: Buffer,
    filename: string,
    userId: string,
    workspaceId?: string
): Promise<ImageUploadResponse> {
    try {
        // Validate
        validateImage(buffer, filename);

        // Generate image ID
        const imageId = uuidv4();

        // Process image sizes
        logger.info('Processing image sizes...');
        const { original, medium, thumb, metadata } = await generateImageSizes(buffer);

        // Upload original to storage
        logger.info('Uploading image to Cloudinary...');
        const url = await uploadImageToCloudinary(
            original,
            userId,
            imageId,
            filename
        );

        // Create Firestore document
        const imageDoc: Omit<CalendarImage, 'createdAt'> & { createdAt: any } = {
            id: imageId,
            userId,
            workspaceId,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            filename,
            storagePath: `calendar-images/${userId}/${imageId}.jpg`,
            url,
            width: metadata.width,
            height: metadata.height,
            meta: {
                format: metadata.format || 'jpeg',
                sizeBytes: original.length,
            },
        };

        await db.collection('calendarImages').doc(imageId).set(imageDoc);

        logger.info(`Image uploaded successfully: ${imageId}`);

        return {
            imageId,
            url,
            meta: {
                format: imageDoc.meta?.format || 'jpeg',
                sizeBytes: imageDoc.meta?.sizeBytes || original.length,
                width: metadata.width,
                height: metadata.height,
            },
        };
    } catch (error: any) {
        logger.error('Error processing and uploading image:', error);
        throw new Error(error.message || 'Failed to upload image');
    }
}

/**
 * Delete image from both Storage and Firestore
 * 
 * @param imageId - Image ID to delete
 * @param userId - User ID (for authorization)
 */
export async function deleteImage(imageId: string, userId: string): Promise<void> {
    try {
        // Get image document
        const imageDoc = await db.collection('calendarImages').doc(imageId).get();

        if (!imageDoc.exists) {
            throw new Error('Image not found');
        }

        const imageData = imageDoc.data() as CalendarImage;

        // Check ownership
        if (imageData.userId !== userId) {
            throw new Error('Unauthorized to delete this image');
        }

        // Delete from Cloudinary
        await deleteAllImageSizes(userId, imageId);

        // Delete from Firestore
        await db.collection('calendarImages').doc(imageId).delete();

        logger.info(`Image deleted successfully: ${imageId}`);
    } catch (error: any) {
        logger.error('Error deleting image:', error);
        throw new Error(error.message || 'Failed to delete image');
    }
}

/**
 * List images for a user
 * 
 * @param userId - User ID
 * @param workspaceId - Optional workspace filter
 * @param limit - Max results (default: 50)
 * @param offset - Pagination offset
 * @returns Array of calendar images
 */
export async function listImages(
    userId: string,
    workspaceId?: string,
    limit: number = 50,
    offset: number = 0
): Promise<CalendarImage[]> {
    try {
        logger.info('Listing images for user:', userId);

        // Simplified query without orderBy to avoid index requirement
        let query = db.collection('calendarImages')
            .where('userId', '==', userId)
            .limit(limit);

        if (workspaceId) {
            query = query.where('workspaceId', '==', workspaceId);
        }

        const snapshot = await query.get();

        logger.info(`Found ${snapshot.docs.length} images for user ${userId}`);

        // Map and sort in memory instead of using Firestore orderBy
        const images = snapshot.docs.map(doc => doc.data() as CalendarImage);
        images.sort((a, b) => {
            const aTime = (a.createdAt as any)?.seconds || 0;
            const bTime = (b.createdAt as any)?.seconds || 0;
            return bTime - aTime; // Descending order (newest first)
        });

        return images;
    } catch (error: any) {
        logger.error('Error listing images:', {
            error: error.message,
            code: error.code,
            userId
        });

        // If the collection doesn't exist or there are no images, return empty array
        if (error.code === 9 || error.message?.includes('index') || error.code === 5) {
            logger.info('No images found or index not created yet, returning empty array');
            return [];
        }

        throw new Error('Failed to list images');
    }
}

/**
 * Get image by ID
 * 
 * @param imageId - Image ID
 * @returns Calendar image or null
 */
export async function getImageById(imageId: string): Promise<CalendarImage | null> {
    try {
        const doc = await db.collection('calendarImages').doc(imageId).get();

        if (!doc.exists) {
            return null;
        }

        return doc.data() as CalendarImage;
    } catch (error) {
        logger.error('Error getting image by ID:', error);
        throw new Error('Failed to get image');
    }
}
