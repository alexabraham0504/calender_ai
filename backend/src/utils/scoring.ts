/**
 * Scoring Utilities
 * Helper functions for calculating scheduling slot scores
 */

import { logger } from './logger';

/**
 * Calculate availability score (0-100)
 * Higher score = fewer conflicts
 */
export function calculateAvailabilityScore(
    slotStart: Date,
    slotEnd: Date,
    existingEvents: any[]
): number {
    let conflicts = 0;
    let partialOverlaps = 0;

    for (const event of existingEvents) {
        const eventStart = new Date(event.startDate);
        const eventEnd = new Date(event.endDate);

        // Check for overlap
        if (slotStart < eventEnd && slotEnd > eventStart) {
            // Full overlap
            if (slotStart >= eventStart && slotEnd <= eventEnd) {
                conflicts += 2; // Severe penalty
            }
            // Partial overlap
            else {
                partialOverlaps += 1;
            }
        }
    }

    // Calculate score
    const totalConflicts = conflicts + (partialOverlaps * 0.5);
    const maxPenalty = 10; // Max conflicts before score hits 0
    const score = Math.max(0, 100 - (totalConflicts / maxPenalty) * 100);

    logger.debug('Availability score calculated', {
        conflicts,
        partialOverlaps,
        score
    });

    return score;
}

/**
 * Calculate preference match score (0-100)
 * Higher score = better match with user preferences
 */
export function calculatePreferenceScore(
    slotStart: Date,
    workingHours?: { start: string; end: string },
    preferredDays?: number[],
    avoidDays?: number[]
): number {
    let score = 50; // Base score

    const slotHour = slotStart.getHours();
    const slotMinute = slotStart.getMinutes();
    const slotDay = slotStart.getDay();

    // Working hours check
    if (workingHours) {
        const [startHour, startMinute] = workingHours.start.split(':').map(Number);
        const [endHour, endMinute] = workingHours.end.split(':').map(Number);

        const slotMinutes = slotHour * 60 + slotMinute;
        const startMinutes = startHour * 60 + startMinute;
        const endMinutes = endHour * 60 + endMinute;

        if (slotMinutes >= startMinutes && slotMinutes <= endMinutes) {
            score += 30; // Within working hours
        } else {
            score -= 30; // Outside working hours
        }
    }

    // Preferred days check
    if (preferredDays && preferredDays.length > 0) {
        if (preferredDays.includes(slotDay)) {
            score += 20;
        } else {
            score -= 10;
        }
    }

    // Avoid days check
    if (avoidDays && avoidDays.length > 0) {
        if (avoidDays.includes(slotDay)) {
            score -= 30;
        }
    }

    // Prefer mid-morning and mid-afternoon
    if (slotHour >= 10 && slotHour <= 11) {
        score += 10; // Mid-morning bonus
    } else if (slotHour >= 14 && slotHour <= 15) {
        score += 10; // Mid-afternoon bonus
    }

    // Avoid very early or very late
    if (slotHour < 8 || slotHour >= 18) {
        score -= 20;
    }

    return Math.max(0, Math.min(100, score));
}

/**
 * Calculate attendee availability score (0-100)
 * Higher score = more attendees available
 */
export function calculateAttendeeAvailabilityScore(
    slotStart: Date,
    slotEnd: Date,
    attendeeEvents: Map<string, any[]>
): number {
    if (attendeeEvents.size === 0) {
        return 100; // No attendees to check
    }

    let availableCount = 0;
    const totalAttendees = attendeeEvents.size;

    for (const [attendee, events] of attendeeEvents.entries()) {
        let isAvailable = true;

        for (const event of events) {
            const eventStart = new Date(event.startDate);
            const eventEnd = new Date(event.endDate);

            // Check for conflict
            if (slotStart < eventEnd && slotEnd > eventStart) {
                isAvailable = false;
                break;
            }
        }

        if (isAvailable) {
            availableCount++;
        }
    }

    const score = (availableCount / totalAttendees) * 100;

    logger.debug('Attendee availability score', {
        availableCount,
        totalAttendees,
        score
    });

    return score;
}

/**
 * Calculate disruption score (0-100)
 * Higher score = fewer events need to be moved
 */
export function calculateDisruptionScore(
    requiredMoves: number,
    totalEvents: number
): number {
    if (totalEvents === 0) {
        return 100; // No events to disrupt
    }

    const disruptionRatio = requiredMoves / totalEvents;
    const score = Math.max(0, 100 - (disruptionRatio * 100));

    logger.debug('Disruption score', {
        requiredMoves,
        totalEvents,
        score
    });

    return score;
}

/**
 * Calculate buffer score (0-100)
 * Higher score = better spacing between events
 */
export function calculateBufferScore(
    slotStart: Date,
    slotEnd: Date,
    existingEvents: any[],
    minBufferMinutes: number = 15
): number {
    let score = 100;

    for (const event of existingEvents) {
        const eventStart = new Date(event.startDate);
        const eventEnd = new Date(event.endDate);

        // Check buffer before slot
        const bufferBefore = (slotStart.getTime() - eventEnd.getTime()) / 60000;
        if (bufferBefore > 0 && bufferBefore < minBufferMinutes) {
            score -= (minBufferMinutes - bufferBefore) * 2;
        }

        // Check buffer after slot
        const bufferAfter = (eventStart.getTime() - slotEnd.getTime()) / 60000;
        if (bufferAfter > 0 && bufferAfter < minBufferMinutes) {
            score -= (minBufferMinutes - bufferAfter) * 2;
        }
    }

    return Math.max(0, score);
}

/**
 * Calculate final composite score
 */
export function calculateCompositeScore(
    availabilityScore: number,
    preferenceScore: number,
    attendeeScore: number,
    disruptionScore: number,
    bufferScore: number = 100
): number {
    // Weighted average
    const weights = {
        availability: 0.35,
        preference: 0.25,
        attendee: 0.20,
        disruption: 0.10,
        buffer: 0.10
    };

    const composite = (
        availabilityScore * weights.availability +
        preferenceScore * weights.preference +
        attendeeScore * weights.attendee +
        disruptionScore * weights.disruption +
        bufferScore * weights.buffer
    );

    logger.debug('Composite score calculated', {
        availabilityScore,
        preferenceScore,
        attendeeScore,
        disruptionScore,
        bufferScore,
        composite
    });

    return Math.round(composite);
}

/**
 * Generate human-readable reason for score
 */
export function generateScoreReason(
    score: number,
    availabilityScore: number,
    preferenceScore: number,
    attendeeScore: number,
    conflicts: number
): string {
    const reasons: string[] = [];

    if (score >= 90) {
        reasons.push('Excellent time slot');
    } else if (score >= 75) {
        reasons.push('Good time slot');
    } else if (score >= 60) {
        reasons.push('Acceptable time slot');
    } else {
        reasons.push('Suboptimal time slot');
    }

    if (availabilityScore === 100) {
        reasons.push('no conflicts');
    } else if (conflicts > 0) {
        reasons.push(`${conflicts} conflict${conflicts > 1 ? 's' : ''}`);
    }

    if (preferenceScore >= 80) {
        reasons.push('matches your preferences');
    } else if (preferenceScore < 50) {
        reasons.push('outside preferred hours');
    }

    if (attendeeScore < 100 && attendeeScore >= 75) {
        reasons.push('most attendees available');
    } else if (attendeeScore < 75) {
        reasons.push('some attendees busy');
    }

    return reasons.join(', ');
}

/**
 * Sort slots by score (descending)
 */
export function sortSlotsByScore<T extends { score: number }>(slots: T[]): T[] {
    return slots.sort((a, b) => b.score - a.score);
}

/**
 * Filter slots by minimum score threshold
 */
export function filterSlotsByMinScore<T extends { score: number }>(
    slots: T[],
    minScore: number = 50
): T[] {
    return slots.filter(slot => slot.score >= minScore);
}

/**
 * Calculate time slot quality tier
 */
export function getSlotQualityTier(score: number): 'excellent' | 'good' | 'fair' | 'poor' {
    if (score >= 90) return 'excellent';
    if (score >= 75) return 'good';
    if (score >= 60) return 'fair';
    return 'poor';
}
