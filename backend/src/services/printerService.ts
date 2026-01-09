/**
 * @fileoverview Printer Service using Puppeteer
 * @module services/printerService
 * 
 * Handles server-side rendering of calendar pages to PDF and PNG using Puppeteer (headless Chrome).
 * 
 * Features:
 * - Renders calendar with image overlays
 * - Supports multiple paper sizes and orientations
 * - High-DPI rendering for print quality
 * - EJS template integration
 * - Configurable margins and settings
 * 
 * Usage:
 *   import { generateCalendarPDF } from './printerService';
 *   const pdfBuffer = await generateCalendarPDF(printRequest);
 * 
 * Production notes:
 * - Ensure Chromium dependencies are installed in Docker
 * - Use --no-sandbox flag in production if needed
 * - Consider caching rendered pages for performance
 */

import puppeteer from 'puppeteer';
import type { Browser, Page, PaperFormat } from 'puppeteer';
import ejs from 'ejs';
import path from 'path';
import { PrintPDFRequest, CalendarImageLayout, ImageLayoutElement } from '../types/image';
import { logger } from '../utils/logger';
import { db } from '../config/firebase';
import { getImageById } from './imageService';

let browserInstance: Browser | null = null;

/**
 * Get or create browser instance (reuse for performance)
 */
async function getBrowser(): Promise<Browser> {
    if (browserInstance && browserInstance.isConnected()) {
        return browserInstance;
    }

    logger.info('Launching Puppeteer browser...');

    browserInstance = await puppeteer.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
            '--ignore-certificate-errors',
        ],
    });

    logger.info('Puppeteer browser launched');

    return browserInstance;
}

/**
 * Close browser instance (call on shutdown)
 */
export async function closeBrowser(): Promise<void> {
    if (browserInstance) {
        await browserInstance.close();
        browserInstance = null;
        logger.info('Puppeteer browser closed');
    }
}

/**
 * Get margin values in millimeters
 */
function getMargins(request: PrintPDFRequest): { top: number; right: number; bottom: number; left: number } {
    if (request.settings.marginPreset === 'custom' && request.settings.customMargins) {
        return request.settings.customMargins;
    }

    const presets = {
        small: { top: 10, right: 10, bottom: 10, left: 10 },
        medium: { top: 20, right: 20, bottom: 20, left: 20 },
        large: { top: 30, right: 30, bottom: 30, left: 30 },
    };

    return presets[request.settings.marginPreset as 'small' | 'medium' | 'large'] || presets.medium;
}

/**
 * Get paper size configuration
 */
function getPaperSize(request: PrintPDFRequest): { width?: string; height?: string; format?: PaperFormat } {
    if (request.settings.paperSize === 'Custom' && request.settings.customPaperWidth && request.settings.customPaperHeight) {
        return {
            width: `${request.settings.customPaperWidth}mm`,
            height: `${request.settings.customPaperHeight}mm`,
        };
    }

    // Return format for standard sizes
    return { format: request.settings.paperSize as PaperFormat };
}

/**
 * Fetch layout for calendar view
 */
async function fetchLayout(request: PrintPDFRequest): Promise<CalendarImageLayout | null> {
    try {
        let query = db.collection('calendarImageLayouts')
            .where('calendarView', '==', request.calendarView)
            .where('year', '==', request.year);

        if (request.month) {
            query = query.where('month', '==', request.month);
        }

        if (request.workspaceId) {
            query = query.where('workspaceId', '==', request.workspaceId);
        }

        const snapshot = await query.limit(1).get();

        if (snapshot.empty) {
            return null;
        }

        return snapshot.docs[0].data() as CalendarImageLayout;
    } catch (error) {
        logger.error('Error fetching layout:', error);
        return null;
    }
}

/**
 * Enrich image elements with actual image URLs
 */
async function enrichImageElements(elements: ImageLayoutElement[]): Promise<Array<ImageLayoutElement & { imageUrl: string }>> {
    const enriched = await Promise.all(
        elements
            .filter(e => e.includeInPrint)
            .map(async (element) => {
                const image = await getImageById(element.imageId);
                return {
                    ...element,
                    imageUrl: image?.url || '',
                };
            })
    );

    return enriched.filter(e => e.imageUrl);
}

/**
 * Generate calendar data for template
 * (Simplified - you should integrate with your existing calendar logic)
 */
function generateCalendarData(request: PrintPDFRequest): any {
    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // Simplified calendar generation - integrate with your actual calendar logic
    const calendarDays: any[] = [];

    if (request.calendarView === 'month' && request.month) {
        // Use noon to avoid any timezone shifts flipping the day
        const firstDayDate = new Date(request.year, request.month - 1, 1, 12, 0, 0);
        const firstDay = firstDayDate.getDay();
        const daysInMonth = new Date(request.year, request.month, 0).getDate();

        console.log(`📅 PDF Data Gen: ${request.year}-${request.month}, First Day Index: ${firstDay}`);

        // Add previous month days
        for (let i = 0; i < firstDay; i++) {
            calendarDays.push({
                date: '',
                isOtherMonth: true,
                isToday: false,
                events: [],
                holidays: [],
            });
        }

        // Add current month days
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(request.year, request.month - 1, day);
            const isToday = date.toDateString() === new Date().toDateString();

            calendarDays.push({
                date: day,
                isOtherMonth: false,
                isToday,
                events: [], // TODO: Fetch actual events
                holidays: [], // TODO: Fetch actual holidays
            });
        }
    }

    return {
        calendarView: request.calendarView,
        year: request.year,
        month: request.month,
        monthNames,
        dayNames,
        calendarDays,
        includeEvents: request.settings.includeEvents,
        includeHolidays: request.settings.includeHolidays,
        includeCaptions: request.settings.includeCaptions,
    };
}

/**
 * Render HTML from template
 */
async function renderTemplate(
    request: PrintPDFRequest,
    imageElements: Array<ImageLayoutElement & { imageUrl: string }>
): Promise<string> {
    const templatePath = path.join(__dirname, '../print/templates/calendarTemplate.html.ejs');

    const margins = getMargins(request);
    const paperConfig = getPaperSize(request);
    const calendarData = generateCalendarData(request);

    // Add background image if provided (not for 'grid' which is handled separately)
    const allImageElements = [...imageElements];
    const isGridBackground = request.imagePosition === 'grid';

    if (request.backgroundImageUrl && !isGridBackground) {
        // Get opacity from request or default to 15%
        const opacity = request.imageOpacity !== undefined ? request.imageOpacity / 100 : 0.15;
        const scaling = request.imageScaling || 'cover';
        const align = request.imageAlign || 'center';
        const position = request.imagePosition || 'full';

        // Calculate positioning based on position setting
        let x = 0;
        let y = 0;
        let width = 1;
        let height = 1;

        if (position === 'top') {
            y = 0;
            height = 0.35; // Top 35%
        } else if (position === 'bottom') {
            y = 0.65; // Start at 65%
            height = 0.35; // Bottom 35%
        } else if (position === 'center') {
            y = 0.3; // Start at 30%
            height = 0.4; // Middle 40%
        } else { // 'full'
            y = 0;
            height = 1; // Full height
        }

        allImageElements.unshift({
            id: 'background',
            imageId: 'background',
            x: x,
            y: y,
            width: width,
            height: height,
            alignment: align as any,
            opacity: opacity,
            zIndex: 5, // Above basic background, but below content (10)
            includeInPrint: true,
            imageUrl: request.backgroundImageUrl,
            scaling: scaling,
        });
    }

    // Log the configuration for debugging
    console.log(`🖼️ PDF Image Config: URL=${!!request.backgroundImageUrl}, Pos=${request.imagePosition}, GridMode=${isGridBackground}`);
    if (isGridBackground) {
        console.log(`   Grid Background URL: ${request.backgroundImageUrl}`);
    }

    const templateData = {
        ...calendarData,
        imageElements: allImageElements,
        margins,
        paperSize: (paperConfig as any).format || 'A4',
        orientation: request.settings.orientation,
        gridBackground: isGridBackground ? {
            url: request.backgroundImageUrl,
            opacity: request.imageOpacity !== undefined ? request.imageOpacity / 100 : 0.15,
            scaling: request.imageScaling || 'cover',
            align: request.imageAlign || 'center'
        } : null
    };

    return ejs.renderFile(templatePath, templateData);
}

/**
 * Generate PDF from calendar print request
 * 
 * @param request - Print request configuration
 * @returns PDF buffer
 */
export async function generateCalendarPDF(request: PrintPDFRequest): Promise<Buffer> {
    let page: Page | null = null;

    try {
        logger.info('Generating calendar PDF...', {
            view: request.calendarView,
            year: request.year,
            month: request.month,
            hasBackgroundImage: !!request.backgroundImageUrl,
            opacity: request.imageOpacity,
            position: request.imagePosition
        });

        // Fetch layout
        const layout = await fetchLayout(request);
        const imageElements = layout ? await enrichImageElements(layout.elements) : [];

        // Render HTML
        const html = await renderTemplate(request, imageElements);
        logger.info(`Rendered HTML length: ${html.length}`);

        if (request.backgroundImageUrl && !html.includes(request.backgroundImageUrl)) {
            logger.error('CRITICAL: Background image URL missing from generated HTML!');
        }

        // Launch browser
        const browser = await getBrowser();
        page = await browser.newPage();

        // Set viewport for DPI
        const scale = request.settings.dpi / 96; // 96 DPI is default
        await page.setViewport({
            width: 1200,
            height: 1600,
            deviceScaleFactor: scale,
        });

        // Set HTML content
        await page.setContent(html, {
            waitUntil: 'networkidle0',
            timeout: 30000,
        });

        // Get paper configuration
        const paperConfig = getPaperSize(request);
        const margins = getMargins(request);

        // Generate PDF
        const pdfBuffer = await page.pdf({
            ...paperConfig,
            landscape: request.settings.orientation === 'landscape',
            margin: {
                top: `${margins.top}mm`,
                right: `${margins.right}mm`,
                bottom: `${margins.bottom}mm`,
                left: `${margins.left}mm`,
            },
            printBackground: true,
            preferCSSPageSize: false,
        });

        logger.info('Calendar PDF generated successfully');

        return Buffer.from(pdfBuffer);
    } catch (error) {
        logger.error('Error generating calendar PDF:', error);
        throw new Error('Failed to generate PDF');
    } finally {
        if (page) {
            await page.close();
        }
    }
}

/**
 * Generate PNG from calendar print request
 * 
 * @param request - Print request configuration
 * @returns PNG buffer
 */
export async function generateCalendarPNG(request: PrintPDFRequest): Promise<Buffer> {
    let page: Page | null = null;

    try {
        logger.info('Generating calendar PNG...', { view: request.calendarView, year: request.year, month: request.month });

        // Fetch layout
        const layout = await fetchLayout(request);
        const imageElements = layout ? await enrichImageElements(layout.elements) : [];

        // Render HTML
        const html = await renderTemplate(request, imageElements);

        // Launch browser
        const browser = await getBrowser();
        page = await browser.newPage();

        // Set viewport based on paper size and DPI
        const scale = request.settings.dpi / 96;
        const width = request.settings.orientation === 'portrait' ? 1200 : 1600;
        const height = request.settings.orientation === 'portrait' ? 1600 : 1200;

        await page.setViewport({
            width,
            height,
            deviceScaleFactor: scale,
        });

        // Set HTML content
        await page.setContent(html, {
            waitUntil: 'networkidle0',
            timeout: 30000,
        });

        // Generate screenshot
        const pngBuffer = await page.screenshot({
            type: 'png',
            fullPage: true,
        });

        logger.info('Calendar PNG generated successfully');

        return Buffer.from(pngBuffer);
    } catch (error) {
        logger.error('Error generating calendar PNG:', error);
        throw new Error('Failed to generate PNG');
    } finally {
        if (page) {
            await page.close();
        }
    }
}
