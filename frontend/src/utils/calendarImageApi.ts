/**
 * @fileoverview Calendar Image API Client
 * @module utils/calendarImageApi
 * 
 * Provides API functions for calendar image integration:
 * - Image upload and management
 * - Layout save/get operations
 * - AI image generation
 * - Print exports (PDF/PNG)
 * 
 * All functions require Firebase authentication token.
 * 
 * Usage:
 *   import { uploadCalendarImage, saveCalendarLayout } from './calendarImageApi';
 *   const result = await uploadCalendarImage(file, token, workspaceId);
 */

import { auth } from '../config/firebase';
import type {
    ImageUploadResponse,
    CalendarImage,
    SaveLayoutRequest,
    CalendarImageLayout,
    AIImageGenerateRequest,
    PrintPDFRequest,
} from '../types/image';

const API_BASE = 'http://localhost:5000/api/calendar';

/**
 * Get auth headers with current user token
 */
async function getHeaders(includeContentType = true): Promise<HeadersInit> {
    const user = auth.currentUser;
    if (!user) {
        throw new Error('User not authenticated');
    }

    const token = await user.getIdToken();

    const headers: HeadersInit = {
        'Authorization': `Bearer ${token}`,
    };

    if (includeContentType) {
        headers['Content-Type'] = 'application/json';
    }

    return headers;
}

/**
 * Upload an image file
 */
export async function uploadCalendarImage(
    file: File,
    workspaceId?: string
): Promise<ImageUploadResponse> {
    const formData = new FormData();
    formData.append('image', file);
    if (workspaceId) {
        formData.append('workspaceId', workspaceId);
    }

    const headers = await getHeaders(false); // Don't set Content-Type, browser will set it with boundary

    const response = await fetch(`${API_BASE}/image/upload`, {
        method: 'POST',
        headers,
        body: formData,
    });

    if (!response.ok) {
        const error = await response.json();
        const errorMsg = error.error || 'Failed to upload image';
        const details = error.details ? `\n${error.details}` : '';
        console.error('Upload error from backend:', error);
        throw new Error(errorMsg + details);
    }

    return response.json();
}

/**
 * Delete an image
 */
export async function deleteCalendarImage(imageId: string): Promise<void> {
    const headers = await getHeaders();

    const response = await fetch(`${API_BASE}/image/delete`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ imageId }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete image');
    }
}

/**
 * List user images
 */
export async function listCalendarImages(
    workspaceId?: string,
    limit = 50,
    offset = 0
): Promise<CalendarImage[]> {
    const headers = await getHeaders();

    const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
    });

    if (workspaceId) {
        params.append('workspaceId', workspaceId);
    }

    const response = await fetch(`${API_BASE}/image/list?${params}`, {
        headers,
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to list images');
    }

    const data = await response.json();
    return data.images;
}

/**
 * Save calendar layout
 */
export async function saveCalendarLayout(
    request: SaveLayoutRequest
): Promise<{ layoutId: string; message: string }> {
    const headers = await getHeaders();

    const response = await fetch(`${API_BASE}/layout/save`, {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save layout');
    }

    return response.json();
}

/**
 * Get calendar layout
 */
export async function getCalendarLayout(
    calendarView: string,
    year: number,
    month?: number,
    week?: number,
    day?: string,
    workspaceId?: string
): Promise<CalendarImageLayout | null> {
    const headers = await getHeaders();

    const params = new URLSearchParams({
        calendarView,
        year: year.toString(),
    });

    if (month) params.append('month', month.toString());
    if (week) params.append('week', week.toString());
    if (day) params.append('day', day);
    if (workspaceId) params.append('workspaceId', workspaceId);

    const response = await fetch(`${API_BASE}/layout/get?${params}`, {
        headers,
    });

    if (response.status === 404) {
        return null; // No layout found
    }

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get layout');
    }

    const data = await response.json();
    return data.layout;
}

/**
 * Generate AI image
 */
export async function generateAIImage(
    request: AIImageGenerateRequest
): Promise<ImageUploadResponse> {
    const headers = await getHeaders();

    const response = await fetch(`${API_BASE}/ai/generate-image`, {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate AI image');
    }

    return response.json();
}

/**
 * Generate PDF export
 */
export async function generatePDF(request: PrintPDFRequest): Promise<Blob> {
    const headers = await getHeaders();

    const response = await fetch(`${API_BASE}/print/pdf`, {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate PDF');
    }

    return response.blob();
}

/**
 * Generate PNG export
 */
export async function generatePNG(request: PrintPDFRequest): Promise<Blob> {
    const headers = await getHeaders();

    const response = await fetch(`${API_BASE}/print/png`, {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate PNG');
    }

    return response.blob();
}

/**
 * Download a blob as a file
 */
export function downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
