/**
 * Chrono Date Parser Wrapper
 * Fallback deterministic date/time parser using chrono-node
 * Used when AI parsing fails or as validation
 */

import * as chrono from 'chrono-node';
import { logger } from './logger';

export interface ParsedDate {
    date: Date;
    confidence: number; // 0-1
    text: string; // matched text
}

export interface ParsedTimeRange {
    start: Date;
    end?: Date;
    duration?: number; // minutes
    confidence: number;
}

/**
 * Parse a date from natural language text
 */
export function parseDateFromText(text: string, referenceDate?: Date): ParsedDate | null {
    try {
        const reference = referenceDate || new Date();
        const results = chrono.parse(text, reference);

        if (results.length === 0) {
            return null;
        }

        const result = results[0];
        const date = result.start.date();

        // Calculate confidence based on how specific the parse was
        let confidence = 0.5;
        if (result.start.get('hour') !== null) confidence += 0.2;
        if (result.start.get('minute') !== null) confidence += 0.1;
        if (result.start.get('day') !== null) confidence += 0.1;
        if (result.start.get('month') !== null) confidence += 0.1;

        logger.debug('Parsed date from text', {
            text: result.text,
            date: date.toISOString(),
            confidence
        });

        return {
            date,
            confidence,
            text: result.text
        };
    } catch (error) {
        logger.error('Error parsing date from text', error);
        return null;
    }
}

/**
 * Parse a time range (start and end) from text
 */
export function parseTimeRange(text: string, referenceDate?: Date): ParsedTimeRange | null {
    try {
        const reference = referenceDate || new Date();
        const results = chrono.parse(text, reference);

        if (results.length === 0) {
            return null;
        }

        const result = results[0];
        const start = result.start.date();
        let end: Date | undefined;
        let duration: number | undefined;

        // Check if end time is specified
        if (result.end) {
            end = result.end.date();
            duration = Math.round((end.getTime() - start.getTime()) / 60000); // minutes
        }

        // Try to extract duration from text
        if (!duration) {
            duration = extractDuration(text);
        }

        // Calculate end time from duration if we have it
        if (duration && !end) {
            end = new Date(start.getTime() + duration * 60000);
        }

        let confidence = 0.6;
        if (end) confidence += 0.2;
        if (result.start.get('hour') !== null) confidence += 0.2;

        logger.debug('Parsed time range', {
            start: start.toISOString(),
            end: end?.toISOString(),
            duration,
            confidence
        });

        return {
            start,
            end,
            duration,
            confidence
        };
    } catch (error) {
        logger.error('Error parsing time range', error);
        return null;
    }
}

/**
 * Extract duration in minutes from text
 */
export function extractDuration(text: string): number | undefined {
    const lowerText = text.toLowerCase();

    // Match patterns like "1 hour", "30 minutes", "2h", "90min"
    const hourMatch = lowerText.match(/(\d+)\s*(hour|hr|h)s?/);
    const minuteMatch = lowerText.match(/(\d+)\s*(minute|min|m)s?/);

    let totalMinutes = 0;

    if (hourMatch) {
        totalMinutes += parseInt(hourMatch[1]) * 60;
    }

    if (minuteMatch) {
        totalMinutes += parseInt(minuteMatch[1]);
    }

    return totalMinutes > 0 ? totalMinutes : undefined;
}

/**
 * Parse relative dates (tomorrow, next week, etc.)
 */
export function parseRelativeDate(text: string, referenceDate?: Date): Date | null {
    const reference = referenceDate || new Date();
    const lowerText = text.toLowerCase();

    // Tomorrow
    if (lowerText.includes('tomorrow')) {
        const tomorrow = new Date(reference);
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow;
    }

    // Next week
    if (lowerText.includes('next week')) {
        const nextWeek = new Date(reference);
        nextWeek.setDate(nextWeek.getDate() + 7);
        return nextWeek;
    }

    // Next month
    if (lowerText.includes('next month')) {
        const nextMonth = new Date(reference);
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        return nextMonth;
    }

    // Use chrono for more complex relative dates
    return parseDateFromText(text, reference)?.date || null;
}

/**
 * Extract day of week preferences from text
 */
export function extractDaysOfWeek(text: string): number[] {
    const lowerText = text.toLowerCase();
    const days: number[] = [];

    const dayMap: { [key: string]: number } = {
        'sunday': 0, 'sun': 0,
        'monday': 1, 'mon': 1,
        'tuesday': 2, 'tue': 2, 'tues': 2,
        'wednesday': 3, 'wed': 3,
        'thursday': 4, 'thu': 4, 'thur': 4, 'thurs': 4,
        'friday': 5, 'fri': 5,
        'saturday': 6, 'sat': 6
    };

    // Check for "weekday" or "weekdays"
    if (lowerText.includes('weekday')) {
        return [1, 2, 3, 4, 5]; // Monday to Friday
    }

    // Check for "weekend"
    if (lowerText.includes('weekend')) {
        return [0, 6]; // Sunday and Saturday
    }

    // Check for specific days
    for (const [dayName, dayNum] of Object.entries(dayMap)) {
        if (lowerText.includes(dayName)) {
            if (!days.includes(dayNum)) {
                days.push(dayNum);
            }
        }
    }

    return days.sort();
}

/**
 * Extract recurrence pattern from text
 */
export function extractRecurrence(text: string): {
    frequency: 'daily' | 'weekly' | 'monthly' | null;
    interval?: number;
    daysOfWeek?: number[];
} {
    const lowerText = text.toLowerCase();

    // Daily
    if (lowerText.includes('every day') || lowerText.includes('daily')) {
        return { frequency: 'daily', interval: 1 };
    }

    // Weekly
    if (lowerText.includes('every week') || lowerText.includes('weekly')) {
        const daysOfWeek = extractDaysOfWeek(text);
        return {
            frequency: 'weekly',
            interval: 1,
            daysOfWeek: daysOfWeek.length > 0 ? daysOfWeek : undefined
        };
    }

    // Monthly
    if (lowerText.includes('every month') || lowerText.includes('monthly')) {
        return { frequency: 'monthly', interval: 1 };
    }

    // Specific days (e.g., "every Monday and Wednesday")
    if (lowerText.includes('every')) {
        const daysOfWeek = extractDaysOfWeek(text);
        if (daysOfWeek.length > 0) {
            return {
                frequency: 'weekly',
                interval: 1,
                daysOfWeek
            };
        }
    }

    return { frequency: null };
}

/**
 * Extract time constraints from text
 */
export function extractTimeConstraints(text: string): {
    notBefore?: string;
    notAfter?: string;
    preferredDays?: number[];
} {
    const lowerText = text.toLowerCase();
    const constraints: any = {};

    // "not before 10am"
    const notBeforeMatch = lowerText.match(/not before (\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
    if (notBeforeMatch) {
        constraints.notBefore = normalizeTime(notBeforeMatch[1]);
    }

    // "not after 5pm"
    const notAfterMatch = lowerText.match(/not after (\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
    if (notAfterMatch) {
        constraints.notAfter = normalizeTime(notAfterMatch[1]);
    }

    // "before 5pm"
    if (!constraints.notAfter) {
        const beforeMatch = lowerText.match(/before (\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
        if (beforeMatch) {
            constraints.notAfter = normalizeTime(beforeMatch[1]);
        }
    }

    // "after 10am"
    if (!constraints.notBefore) {
        const afterMatch = lowerText.match(/after (\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
        if (afterMatch) {
            constraints.notBefore = normalizeTime(afterMatch[1]);
        }
    }

    // Preferred days
    const preferredDays = extractDaysOfWeek(text);
    if (preferredDays.length > 0) {
        constraints.preferredDays = preferredDays;
    }

    return constraints;
}

/**
 * Normalize time string to HH:MM format
 */
function normalizeTime(timeStr: string): string {
    const lowerTime = timeStr.toLowerCase().trim();

    // Parse with chrono
    const parsed = chrono.parseDate(`today at ${lowerTime}`);
    if (parsed) {
        const hours = parsed.getHours().toString().padStart(2, '0');
        const minutes = parsed.getMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}`;
    }

    return timeStr;
}

/**
 * Extract attendees/participants from text
 */
export function extractAttendees(text: string): string[] {
    const attendees: string[] = [];

    // Email addresses
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const emails = text.match(emailRegex);
    if (emails) {
        attendees.push(...emails);
    }

    // Names after "with" keyword
    const withMatch = text.match(/with\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g);
    if (withMatch) {
        withMatch.forEach(match => {
            const name = match.replace(/^with\s+/i, '').trim();
            if (name && !attendees.includes(name)) {
                attendees.push(name);
            }
        });
    }

    return attendees;
}
