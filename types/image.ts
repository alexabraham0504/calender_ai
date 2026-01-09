/**
 * @fileoverview Type definitions for Calendar Image Integration feature
 * @module types/image
 * 
 * Defines TypeScript interfaces for:
 * - Calendar image metadata
 * - Image layout configurations
 * - Print settings
 * - Image element positioning and styling
 * 
 * These types are shared between frontend and backend to ensure type safety.
 */

import { Timestamp } from 'firebase-admin/firestore';

/**
 * Represents an uploaded or generated image stored in Firebase Storage
 */
export interface CalendarImage {
    id: string;
    userId: string;
    workspaceId?: string;
    createdAt: Timestamp;
    filename: string;
    storagePath: string;
    url: string;
    width?: number;
    height?: number;
    meta?: {
        format: string;
        sizeBytes: number;
    };
}

/**
 * Crop configuration for image elements
 */
export interface ImageCrop {
    x: number;       // relative 0..1
    y: number;       // relative 0..1
    width: number;   // relative 0..1
    height: number;  // relative 0..1
}

/**
 * Alignment options for image placement
 */
export type ImageAlignment = 'left' | 'center' | 'right' | 'top' | 'bottom';

/**
 * Individual image element placed on calendar view
 */
export interface ImageLayoutElement {
    id: string;
    imageId: string;
    x: number;          // relative position 0..1
    y: number;          // relative position 0..1
    width: number;      // relative size 0..1
    height: number;     // relative size 0..1
    alignment: ImageAlignment;
    opacity: number;    // 0..1
    zIndex: number;
    crop?: ImageCrop;
    caption?: string;
    includeInPrint: boolean;
    scaling?: string; // 'cover', 'contain', 'auto', etc.
}

/**
 * Calendar view type
 */
export type CalendarView = 'year' | 'month' | 'week' | 'day';

/**
 * Complete layout configuration for a calendar view
 */
export interface CalendarImageLayout {
    id: string;
    userId: string;
    calendarView: CalendarView;
    year: number;
    month?: number;     // 1-12, optional for year view
    week?: number;      // week number, optional for week view
    day?: string;       // ISO date string, optional for day view
    workspaceId?: string;
    elements: ImageLayoutElement[];
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

/**
 * Paper size options for printing
 */
export type PaperSize = 'A4' | 'A5' | 'Letter' | 'Legal' | 'Custom';

/**
 * Page orientation
 */
export type PageOrientation = 'portrait' | 'landscape';

/**
 * Margin presets
 */
export type MarginPreset = 'small' | 'medium' | 'large' | 'custom';

/**
 * Custom margin configuration (in millimeters)
 */
export interface CustomMargins {
    top: number;
    right: number;
    bottom: number;
    left: number;
}

/**
 * Print configuration settings
 */
export interface PrintSettings {
    paperSize: PaperSize;
    orientation: PageOrientation;
    dpi: 150 | 300;
    includeEvents: boolean;
    includeHolidays: boolean;
    includeCaptions: boolean;
    marginPreset: MarginPreset;
    customMargins?: CustomMargins;
    customPaperWidth?: number;  // in mm
    customPaperHeight?: number; // in mm
}

/**
 * Request to generate PDF
 */
export interface PrintPDFRequest {
    calendarView: CalendarView;
    year: number;
    month?: number;
    week?: number;
    day?: string;
    workspaceId?: string;
    backgroundImageUrl?: string; // URL of background image for the calendar
    imageOpacity?: number; // 0-100
    imagePosition?: string; // 'full', 'top', 'bottom', 'center'
    imageScaling?: string; // 'cover', 'contain', 'auto'
    imageAlign?: string; // 'center', 'left', 'right'
    settings: PrintSettings;
}

/**
 * AI Image generation request
 */
export interface AIImageGenerateRequest {
    prompt: string;
    aspectRatio?: '1:1' | '16:9' | '4:3' | '3:4' | '9:16';
    stylePreset?: string;
    colorPalette?: string[];
    workspaceId?: string;
}

/**
 * Upload image request metadata
 */
export interface ImageUploadMeta {
    userId: string;
    workspaceId?: string;
    filename: string;
}

/**
 * Response after successful image upload
 */
export interface ImageUploadResponse {
    imageId: string;
    url: string;
    meta: {
        format: string;
        sizeBytes: number;
        width?: number;
        height?: number;
    };
}

/**
 * Layout save request
 */
export interface SaveLayoutRequest {
    layoutId?: string;
    calendarView: CalendarView;
    year: number;
    month?: number;
    week?: number;
    day?: string;
    workspaceId?: string;
    elements: ImageLayoutElement[];
}

/**
 * Layout version for history tracking
 */
export interface LayoutVersion {
    versionId: string;
    layoutId: string;
    elements: ImageLayoutElement[];
    createdAt: Timestamp;
    createdBy: string;
}
