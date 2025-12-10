/**
 * Scheduler Service
 * Core scheduling algorithm for finding and scoring available time slots
 */

import { db } from '../config/firebase';
import { logger } from '../utils/logger';
import {
    SchedulingContext,
    SuggestedSlot,
    ConflictInfo,
    EventMove,
    ParsedIntent
} from '../types/ai';
import {
    calculateAvailabilityScore,
    calculatePreferenceScore,
    calculateAttendeeAvailabilityScore,
    calculateDisruptionScore,
    calculateBufferScore,
    calculateCompositeScore,
    generateScoreReason,
    sortSlotsByScore
} from '../utils/scoring';
import { v4 as uuidv4 } from 'uuid';

const eventsCollection = db.collection('events');
const workspacesCollection = db.collection('workspaces');

/**
 * Find available time slots based on scheduling context
 */
export async function findAvailableSlots(
    context: SchedulingContext
): Promise<SuggestedSlot[]> {
    try {
        logger.debug('Finding available slots', {
            userId: context.userId,
            workspaceId: context.workspaceId
        });

        const slots: SuggestedSlot[] = [];
        const { parsedIntent, searchWindowStart, searchWindowEnd } = context;

        // Get duration (default 60 minutes)
        const duration = parsedIntent.duration || 60;

        // Get existing events
        const existingEvents = await getExistingEvents(
            context.userId,
            searchWindowStart,
            searchWindowEnd,
            context.workspaceId
        );

        // Get attendee events if needed
        let attendeeEventsMap = new Map<string, any[]>();
        if (parsedIntent.attendees && parsedIntent.attendees.length > 0) {
            attendeeEventsMap = await getAttendeeEvents(
                parsedIntent.attendees,
                searchWindowStart,
                searchWindowEnd,
                context.workspaceId
            );
        }

        // Generate candidate slots
        const candidates = generateCandidateSlots(
            new Date(searchWindowStart),
            new Date(searchWindowEnd),
            duration,
            context.workingHours,
            parsedIntent.constraints
        );

        logger.debug('Generated candidate slots', { count: candidates.length });

        // Score each candidate
        for (const candidate of candidates) {
            const slot = await scoreSlot(
                candidate.start,
                candidate.end,
                existingEvents,
                attendeeEventsMap,
                context
            );

            // Only include slots with reasonable scores
            if (slot.score >= 40) {
                slots.push(slot);
            }
        }

        // Sort by score and return top results
        const sortedSlots = sortSlotsByScore(slots);
        const topSlots = sortedSlots.slice(0, 10);

        logger.success('Found available slots', { count: topSlots.length });
        return topSlots;
    } catch (error) {
        logger.error('Error finding available slots', error);
        throw error;
    }
}

/**
 * Score a specific time slot
 */
export async function scoreSlot(
    slotStart: Date,
    slotEnd: Date,
    existingEvents: any[],
    attendeeEvents: Map<string, any[]>,
    context: SchedulingContext
): Promise<SuggestedSlot> {
    // Find conflicts
    const conflicts = findConflicts(slotStart, slotEnd, existingEvents);

    // Calculate individual scores
    const availabilityScore = calculateAvailabilityScore(
        slotStart,
        slotEnd,
        existingEvents
    );

    const preferenceScore = calculatePreferenceScore(
        slotStart,
        context.workingHours,
        context.parsedIntent.constraints?.preferredDays,
        context.parsedIntent.constraints?.avoidDays
    );

    const attendeeScore = calculateAttendeeAvailabilityScore(
        slotStart,
        slotEnd,
        attendeeEvents
    );

    const bufferScore = calculateBufferScore(
        slotStart,
        slotEnd,
        existingEvents,
        parseInt(process.env.MIN_EVENT_BUFFER_MINUTES || '15')
    );

    // Calculate moves needed if there are conflicts
    const requiredMoves = conflicts.length > 0
        ? proposeEventMoves(conflicts, slotStart, slotEnd, existingEvents)
        : [];

    const disruptionScore = calculateDisruptionScore(
        requiredMoves.length,
        existingEvents.length
    );

    // Calculate composite score
    const finalScore = calculateCompositeScore(
        availabilityScore,
        preferenceScore,
        attendeeScore,
        disruptionScore,
        bufferScore
    );

    // Generate warnings
    const warnings: string[] = [];
    if (conflicts.length > 0) {
        warnings.push(`${conflicts.length} scheduling conflict${conflicts.length > 1 ? 's' : ''}`);
    }
    if (preferenceScore < 50) {
        warnings.push('Outside preferred working hours');
    }
    if (attendeeScore < 75 && attendeeEvents.size > 0) {
        warnings.push('Some attendees may be unavailable');
    }

    // Generate human-readable reason
    const reason = generateScoreReason(
        finalScore,
        availabilityScore,
        preferenceScore,
        attendeeScore,
        conflicts.length
    );

    return {
        id: uuidv4(),
        startTime: slotStart.toISOString(),
        endTime: slotEnd.toISOString(),
        score: finalScore,
        scoreBreakdown: {
            availability: Math.round(availabilityScore),
            preferenceMatch: Math.round(preferenceScore),
            attendeeAvailability: Math.round(attendeeScore),
            minimalDisruption: Math.round(disruptionScore)
        },
        conflicts,
        warnings,
        reason,
        requiredMoves
    };
}

/**
 * Find conflicts with existing events
 */
export function findConflicts(
    slotStart: Date,
    slotEnd: Date,
    existingEvents: any[]
): ConflictInfo[] {
    const conflicts: ConflictInfo[] = [];

    for (const event of existingEvents) {
        const eventStart = new Date(event.startDate);
        const eventEnd = new Date(event.endDate);

        // Check for overlap
        if (slotStart < eventEnd && slotEnd > eventStart) {
            conflicts.push({
                eventId: event.id || event._id,
                eventTitle: event.title,
                eventStart: event.startDate,
                eventEnd: event.endDate,
                severity: event.isImmutable ? 'hard' : 'soft',
                canMove: !event.isImmutable && (event.priority === 'low' || event.isFlexible),
                priority: event.priority || 'medium'
            });
        }
    }

    return conflicts;
}

/**
 * Propose moves for conflicting events
 */
export function proposeEventMoves(
    conflicts: ConflictInfo[],
    slotStart: Date,
    slotEnd: Date,
    allEvents: any[]
): EventMove[] {
    const moves: EventMove[] = [];

    for (const conflict of conflicts) {
        // Only propose moves for movable events
        if (!conflict.canMove) {
            continue;
        }

        const event = allEvents.find(e => (e.id || e._id) === conflict.eventId);
        if (!event) continue;

        const eventDuration = new Date(event.endDate).getTime() - new Date(event.startDate).getTime();

        // Try to find a new slot after the requested slot
        const proposedStart = new Date(slotEnd.getTime() + 15 * 60000); // 15 min buffer
        const proposedEnd = new Date(proposedStart.getTime() + eventDuration);

        // Check if proposed slot conflicts with other events
        const hasNewConflicts = allEvents.some(e => {
            if ((e.id || e._id) === conflict.eventId) return false;
            const eStart = new Date(e.startDate);
            const eEnd = new Date(e.endDate);
            return proposedStart < eEnd && proposedEnd > eStart;
        });

        if (!hasNewConflicts) {
            moves.push({
                eventId: conflict.eventId,
                eventTitle: conflict.eventTitle,
                currentStart: conflict.eventStart,
                currentEnd: conflict.eventEnd,
                proposedStart: proposedStart.toISOString(),
                proposedEnd: proposedEnd.toISOString(),
                reason: 'To accommodate new event'
            });
        }
    }

    return moves;
}

/**
 * Generate candidate time slots
 */
function generateCandidateSlots(
    windowStart: Date,
    windowEnd: Date,
    duration: number,
    workingHours?: { start: string; end: string },
    constraints?: any
): Array<{ start: Date; end: Date }> {
    const candidates: Array<{ start: Date; end: Date }> = [];
    const current = new Date(windowStart);

    // Set to start of working hours if specified
    if (workingHours) {
        const [startHour, startMinute] = workingHours.start.split(':').map(Number);
        current.setHours(startHour, startMinute, 0, 0);
    }

    // Generate slots every 30 minutes
    const slotInterval = 30; // minutes
    let iterations = 0;
    const maxIterations = 1000; // Safety limit

    while (current < windowEnd && iterations < maxIterations) {
        const slotEnd = new Date(current.getTime() + duration * 60000);

        // Check if slot is within working hours
        if (workingHours) {
            const [, endHour, endMinute] = workingHours.end.split(':').map(Number);
            const workingEndTime = current.getHours() * 60 + current.getMinutes();
            const workingEndMinutes = endHour * 60 + endMinute;

            if (workingEndTime >= workingEndMinutes) {
                // Move to next day
                current.setDate(current.getDate() + 1);
                const [startHour, startMinute] = workingHours.start.split(':').map(Number);
                current.setHours(startHour, startMinute, 0, 0);
                iterations++;
                continue;
            }
        }

        // Check constraints
        if (constraints) {
            // Not before constraint
            if (constraints.notBefore) {
                const [hour, minute] = constraints.notBefore.split(':').map(Number);
                const slotMinutes = current.getHours() * 60 + current.getMinutes();
                const constraintMinutes = hour * 60 + minute;
                if (slotMinutes < constraintMinutes) {
                    current.setMinutes(current.getMinutes() + slotInterval);
                    iterations++;
                    continue;
                }
            }

            // Not after constraint
            if (constraints.notAfter) {
                const [hour, minute] = constraints.notAfter.split(':').map(Number);
                const slotMinutes = current.getHours() * 60 + current.getMinutes();
                const constraintMinutes = hour * 60 + minute;
                if (slotMinutes > constraintMinutes) {
                    // Move to next day
                    current.setDate(current.getDate() + 1);
                    if (workingHours) {
                        const [startHour, startMinute] = workingHours.start.split(':').map(Number);
                        current.setHours(startHour, startMinute, 0, 0);
                    }
                    iterations++;
                    continue;
                }
            }

            // Preferred days
            if (constraints.preferredDays && constraints.preferredDays.length > 0) {
                if (!constraints.preferredDays.includes(current.getDay())) {
                    // Skip to next day
                    current.setDate(current.getDate() + 1);
                    if (workingHours) {
                        const [startHour, startMinute] = workingHours.start.split(':').map(Number);
                        current.setHours(startHour, startMinute, 0, 0);
                    }
                    iterations++;
                    continue;
                }
            }
        }

        candidates.push({
            start: new Date(current),
            end: slotEnd
        });

        current.setMinutes(current.getMinutes() + slotInterval);
        iterations++;
    }

    return candidates;
}

/**
 * Get existing events for user in time window
 */
async function getExistingEvents(
    userId: string,
    windowStart: string,
    windowEnd: string,
    workspaceId?: string
): Promise<any[]> {
    try {
        let query = eventsCollection
            .where('userId', '==', userId)
            .where('startDate', '>=', windowStart)
            .where('startDate', '<=', windowEnd);

        if (workspaceId) {
            query = query.where('workspaceId', '==', workspaceId);
        }

        const snapshot = await query.get();
        const events = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        logger.debug('Retrieved existing events', { count: events.length });
        return events;
    } catch (error) {
        logger.error('Error getting existing events', error);
        return [];
    }
}

/**
 * Get events for attendees
 */
async function getAttendeeEvents(
    attendees: string[],
    windowStart: string,
    windowEnd: string,
    workspaceId?: string
): Promise<Map<string, any[]>> {
    const attendeeEventsMap = new Map<string, any[]>();

    // For now, return empty map
    // In production, this would query workspace members' calendars
    // with proper permission checks

    logger.debug('Attendee events query skipped (not implemented)', {
        attendees: attendees.length
    });

    return attendeeEventsMap;
}

/**
 * Schedule an event using a suggested slot
 */
export async function scheduleEvent(
    slot: SuggestedSlot,
    parsedIntent: ParsedIntent,
    userId: string,
    workspaceId?: string,
    autoResolveConflicts: boolean = false
): Promise<{ eventId: string; movedEvents: EventMove[] }> {
    try {
        logger.debug('Scheduling event', {
            slotId: slot.id,
            autoResolve: autoResolveConflicts
        });

        const movedEvents: EventMove[] = [];

        // If auto-resolve is enabled and there are conflicts, move them
        if (autoResolveConflicts && slot.requiredMoves && slot.requiredMoves.length > 0) {
            for (const move of slot.requiredMoves) {
                await moveEvent(move);
                movedEvents.push(move);
            }
        }

        // Create the new event
        const newEvent = {
            userId,
            workspaceId: workspaceId || null,
            title: parsedIntent.title || 'New Event',
            description: parsedIntent.description || '',
            startDate: slot.startTime,
            endDate: slot.endTime,
            isAllDay: false,
            priority: parsedIntent.priority || 'medium',
            isFlexible: parsedIntent.isFlexible || false,
            isImmutable: parsedIntent.isImmutable || false,
            location: parsedIntent.location,
            createdBy: userId,
            createdAt: new Date().toISOString()
        };

        const docRef = await eventsCollection.add(newEvent);

        logger.success('Event scheduled successfully', { eventId: docRef.id });

        return {
            eventId: docRef.id,
            movedEvents
        };
    } catch (error) {
        logger.error('Error scheduling event', error);
        throw error;
    }
}

/**
 * Move an event to a new time
 */
async function moveEvent(move: EventMove): Promise<void> {
    try {
        await eventsCollection.doc(move.eventId).update({
            startDate: move.proposedStart,
            endDate: move.proposedEnd,
            updatedAt: new Date().toISOString()
        });

        logger.info('Event moved', { eventId: move.eventId });
    } catch (error) {
        logger.error('Error moving event', error);
        throw error;
    }
}
