/**
 * @fileoverview Print Controller
 * @module controllers/printController
 * 
 * Handles HTTP requests for calendar printing:
 * - Generate PDF exports
 * - Generate PNG exports
 * - Validate print settings
 * 
 * Uses Puppeteer service for server-side rendering.
 * All endpoints require Firebase authentication.
 */

import { Request, Response } from 'express';
import { generateCalendarPDF, generateCalendarPNG } from '../services/printerService';
import { PrintPDFRequest } from '../types/image';
import { logger } from '../utils/logger';

/**
 * Validate print request
 */
function validatePrintRequest(body: any): PrintPDFRequest | null {
    if (!body.calendarView || !body.year || !body.settings) {
        return null;
    }

    // Validate settings
    const validPaperSizes = ['A4', 'A5', 'Letter', 'Legal', 'Custom'];
    const validOrientations = ['portrait', 'landscape'];
    const validDPIs = [150, 300];

    if (!validPaperSizes.includes(body.settings.paperSize)) {
        return null;
    }

    if (!validOrientations.includes(body.settings.orientation)) {
        return null;
    }

    if (!validDPIs.includes(body.settings.dpi)) {
        return null;
    }

    return body as PrintPDFRequest;
}

/**
 * POST /api/calendar/print/pdf
 * Generate PDF from calendar
 */
export async function generatePDF(req: Request & { user?: any }, res: Response): Promise<void> {
    try {
        const userId = req.user?.uid;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const printRequest = validatePrintRequest(req.body);
        if (!printRequest) {
            res.status(400).json({ error: 'Invalid print request' });
            return;
        }

        logger.info('Generating PDF', {
            userId,
            view: printRequest.calendarView,
            year: printRequest.year,
            month: printRequest.month
        });

        const pdfBuffer = await generateCalendarPDF(printRequest);

        // Set response headers
        const filename = `calendar_${printRequest.calendarView}_${printRequest.year}${printRequest.month ? `_${printRequest.month}` : ''}.pdf`;

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', pdfBuffer.length);

        res.status(200).send(pdfBuffer);

        logger.info('PDF generated successfully', { userId, filename });
    } catch (error: any) {
        logger.error('Generate PDF error:', error);
        res.status(500).json({ error: error.message || 'Failed to generate PDF' });
    }
}

/**
 * POST /api/calendar/print/png
 * Generate PNG from calendar
 */
export async function generatePNG(req: Request & { user?: any }, res: Response): Promise<void> {
    try {
        const userId = req.user?.uid;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const printRequest = validatePrintRequest(req.body);
        if (!printRequest) {
            res.status(400).json({ error: 'Invalid print request' });
            return;
        }

        logger.info('Generating PNG', {
            userId,
            view: printRequest.calendarView,
            year: printRequest.year,
            month: printRequest.month
        });

        const pngBuffer = await generateCalendarPNG(printRequest);

        // Set response headers
        const filename = `calendar_${printRequest.calendarView}_${printRequest.year}${printRequest.month ? `_${printRequest.month}` : ''}.png`;

        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', pngBuffer.length);

        res.status(200).send(pngBuffer);

        logger.info('PNG generated successfully', { userId, filename });
    } catch (error: any) {
        logger.error('Generate PNG error:', error);
        res.status(500).json({ error: error.message || 'Failed to generate PNG' });
    }
}
