/**
 * Frontend AI Type Definitions
 * TypeScript interfaces for AI-powered scheduling (mirrors backend types)
 */

export interface ParsedIntent {
    // Event details
    title?: string;
    description?: string;
    startDate?: string; // ISO string
    endDate?: string; // ISO string
    duration?: number; // minutes

    // Scheduling preferences
    recurrence?: {
        frequency: 'daily' | 'weekly' | 'monthly';
        interval?: number;
        daysOfWeek?: number[]; // 0-6, Sunday = 0
        endDate?: string;
        count?: number;
    };

    // Context
    attendees?: string[]; // emails or names
    location?: string;
    priority?: 'low' | 'medium' | 'high';

    // Constraints
    constraints?: {
        notBefore?: string; // time like "10:00"
        notAfter?: string; // time like "17:00"
        preferredDays?: number[]; // 0-6
        avoidDays?: number[];
        mustBeBefore?: string; // ISO date
        mustBeAfter?: string; // ISO date
    };

    // Metadata
    isFlexible?: boolean;
    isImmutable?: boolean;
    confidence?: number; // 0-1
    ambiguities?: string[];
}

export interface SuggestedSlot {
    id: string;
    startTime: string; // ISO
    endTime: string; // ISO
    score: number; // 0-100

    // Scoring breakdown
    scoreBreakdown: {
        availability: number;
        preferenceMatch: number;
        attendeeAvailability: number;
        minimalDisruption: number;
    };

    // Conflicts and issues
    conflicts: ConflictInfo[];
    warnings: string[];

    // Human-readable explanation
    reason: string;

    // Potential changes needed
    requiredMoves?: EventMove[];
}

export interface ConflictInfo {
    eventId: string;
    eventTitle: string;
    eventStart: string;
    eventEnd: string;
    severity: 'hard' | 'soft';
    canMove: boolean;
    priority: 'low' | 'medium' | 'high';
}

export interface EventMove {
    eventId: string;
    eventTitle: string;
    currentStart: string;
    currentEnd: string;
    proposedStart: string;
    proposedEnd: string;
    reason: string;
}

export interface AIResponse {
    success: boolean;
    parsedIntent?: ParsedIntent;
    suggestions?: SuggestedSlot[];
    clarificationNeeded?: boolean;
    clarificationQuestion?: string;
    error?: string;
}

export interface ScheduleResult {
    success: boolean;
    eventId?: string;
    movedEvents?: EventMove[];
    message: string;
}

export type SlotQuality = 'excellent' | 'good' | 'fair' | 'poor';

export interface AIStatus {
    success: boolean;
    enabled: boolean;
    provider: string;
    features: {
        parsing: boolean;
        suggestions: boolean;
        autoSchedule: boolean;
    };
}
