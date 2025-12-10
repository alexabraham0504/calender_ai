/**
 * Mock AI Provider Adapter
 * Deterministic AI provider for testing and development
 * No external API calls, fast responses
 */

import { AIProvider, ParsedIntent, SchedulingContext, SuggestedSlot } from '../types/ai';
import { logger } from '../utils/logger';
import {
    parseDateFromText,
    parseTimeRange,
    extractDuration,
    extractRecurrence,
    extractTimeConstraints,
    extractAttendees
} from '../utils/chronoWrapper';
import { v4 as uuidv4 } from 'uuid';

export class MockAIAdapter implements AIProvider {
    /**
     * Parse intent using deterministic rules
     */
    async parseIntent(prompt: string, context?: any): Promise<ParsedIntent> {
        logger.debug('MockAI: Parsing intent', { promptLength: prompt.length });

        const lowerPrompt = prompt.toLowerCase();
        const intent: ParsedIntent = {
            confidence: 0.8,
            ambiguities: []
        };

        // Extract title (first few words or everything before time/date)
        const titleMatch = prompt.match(/^([^,]+?)(?:\s+(?:at|on|tomorrow|next|every|for)|\s*$)/i);
        if (titleMatch) {
            intent.title = titleMatch[1].trim();
        } else {
            intent.title = prompt.split(/\s+/).slice(0, 5).join(' ');
        }

        // Parse time range
        const timeRange = parseTimeRange(prompt);
        if (timeRange) {
            intent.startDate = timeRange.start.toISOString();
            if (timeRange.end) {
                intent.endDate = timeRange.end.toISOString();
            }
            if (timeRange.duration) {
                intent.duration = timeRange.duration;
            }
        } else {
            intent.ambiguities?.push('start_time');
        }

        // Extract duration if not from time range
        if (!intent.duration) {
            const duration = extractDuration(prompt);
            if (duration) {
                intent.duration = duration;
            }
        }

        // Extract recurrence
        const recurrence = extractRecurrence(prompt);
        if (recurrence.frequency) {
            intent.recurrence = {
                frequency: recurrence.frequency,
                interval: recurrence.interval,
                daysOfWeek: recurrence.daysOfWeek
            };
        }

        // Extract attendees
        const attendees = extractAttendees(prompt);
        if (attendees.length > 0) {
            intent.attendees = attendees;
        }

        // Extract constraints
        const constraints = extractTimeConstraints(prompt);
        if (Object.keys(constraints).length > 0) {
            intent.constraints = constraints;
        }

        // Determine priority
        if (lowerPrompt.includes('urgent') || lowerPrompt.includes('important')) {
            intent.priority = 'high';
        } else if (lowerPrompt.includes('low priority') || lowerPrompt.includes('optional')) {
            intent.priority = 'low';
        } else {
            intent.priority = 'medium';
        }

        // Determine flexibility
        intent.isFlexible = lowerPrompt.includes('flexible') || lowerPrompt.includes('whenever');
        intent.isImmutable = lowerPrompt.includes('must be') || lowerPrompt.includes('cannot move');

        // Extract location
        const locationMatch = prompt.match(/(?:at|in|@)\s+([A-Z][a-zA-Z\s]+(?:Room|Office|Building|Hall)?)/);
        if (locationMatch) {
            intent.location = locationMatch[1].trim();
        }

        // Extract description
        const descMatch = prompt.match(/(?:about|regarding|re:)\s+(.+)/i);
        if (descMatch) {
            intent.description = descMatch[1].trim();
        }

        logger.success('MockAI: Intent parsed', {
            title: intent.title,
            hasStartDate: !!intent.startDate,
            hasDuration: !!intent.duration,
            confidence: intent.confidence
        });

        return intent;
    }

    /**
     * Generate mock suggestions (simple algorithm)
     */
    async suggestSlots(context: SchedulingContext): Promise<SuggestedSlot[]> {
        logger.debug('MockAI: Generating slot suggestions');

        const slots: SuggestedSlot[] = [];
        const { parsedIntent, searchWindowStart, searchWindowEnd, workingHours } = context;

        const windowStart = new Date(searchWindowStart);
        const windowEnd = new Date(searchWindowEnd);
        const duration = parsedIntent.duration || 60; // Default 1 hour

        // Generate slots every hour within working hours
        const currentSlot = new Date(windowStart);

        // Set to start of working hours
        if (workingHours) {
            const [startHour] = workingHours.start.split(':').map(Number);
            currentSlot.setHours(startHour, 0, 0, 0);
        }

        let slotCount = 0;
        const maxSlots = 10;

        while (currentSlot < windowEnd && slotCount < maxSlots) {
            const slotEnd = new Date(currentSlot.getTime() + duration * 60000);

            // Skip if outside working hours
            if (workingHours) {
                const [, endHour] = workingHours.end.split(':').map(Number);
                if (currentSlot.getHours() >= endHour) {
                    // Move to next day
                    currentSlot.setDate(currentSlot.getDate() + 1);
                    const [startHour] = workingHours.start.split(':').map(Number);
                    currentSlot.setHours(startHour, 0, 0, 0);
                    continue;
                }
            }

            // Check for conflicts
            const conflicts = this.findConflicts(
                currentSlot,
                slotEnd,
                context.existingEvents || []
            );

            // Calculate simple score
            const hasConflicts = conflicts.length > 0;
            const isWorkingHours = this.isWithinWorkingHours(currentSlot, workingHours);

            let score = 100;
            if (hasConflicts) score -= conflicts.length * 20;
            if (!isWorkingHours) score -= 30;

            score = Math.max(0, Math.min(100, score));

            // Only add if score is reasonable
            if (score >= 40) {
                slots.push({
                    id: uuidv4(),
                    startTime: currentSlot.toISOString(),
                    endTime: slotEnd.toISOString(),
                    score,
                    scoreBreakdown: {
                        availability: hasConflicts ? 50 : 100,
                        preferenceMatch: isWorkingHours ? 100 : 50,
                        attendeeAvailability: 100,
                        minimalDisruption: 100
                    },
                    conflicts,
                    warnings: hasConflicts ? ['Has scheduling conflicts'] : [],
                    reason: this.generateReason(score, hasConflicts, isWorkingHours),
                    requiredMoves: []
                });

                slotCount++;
            }

            // Move to next hour
            currentSlot.setHours(currentSlot.getHours() + 1);
        }

        // Sort by score
        slots.sort((a, b) => b.score - a.score);

        logger.success('MockAI: Generated suggestions', { count: slots.length });
        return slots.slice(0, 5); // Return top 5
    }

    /**
     * Generate clarifying question
     */
    async generateClarification(prompt: string, ambiguities: string[]): Promise<string> {
        if (ambiguities.includes('start_time')) {
            return 'When would you like to schedule this event? Please specify a date and time.';
        }

        if (ambiguities.includes('duration')) {
            return 'How long should this event be?';
        }

        if (ambiguities.includes('attendees')) {
            return 'Who should attend this meeting?';
        }

        return 'Could you provide more details about when you want to schedule this event?';
    }

    /**
     * Find conflicts with existing events
     */
    private findConflicts(
        slotStart: Date,
        slotEnd: Date,
        existingEvents: any[]
    ): any[] {
        const conflicts: any[] = [];

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
                    severity: 'hard',
                    canMove: event.priority === 'low',
                    priority: event.priority || 'medium'
                });
            }
        }

        return conflicts;
    }

    /**
     * Check if time is within working hours
     */
    private isWithinWorkingHours(
        time: Date,
        workingHours?: { start: string; end: string }
    ): boolean {
        if (!workingHours) return true;

        const [startHour] = workingHours.start.split(':').map(Number);
        const [endHour] = workingHours.end.split(':').map(Number);
        const hour = time.getHours();

        return hour >= startHour && hour < endHour;
    }

    /**
     * Generate human-readable reason
     */
    private generateReason(
        score: number,
        hasConflicts: boolean,
        isWorkingHours: boolean
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

        if (!hasConflicts) {
            reasons.push('no conflicts');
        } else {
            reasons.push('has conflicts');
        }

        if (isWorkingHours) {
            reasons.push('within working hours');
        } else {
            reasons.push('outside working hours');
        }

        return reasons.join(', ');
    }
}
