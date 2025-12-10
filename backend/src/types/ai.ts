/**
 * AI Type Definitions
 * Core interfaces for AI-powered scheduling system
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
    isFlexible?: boolean; // Can be rescheduled
    isImmutable?: boolean; // Cannot be moved
    confidence?: number; // 0-1, parser confidence
    ambiguities?: string[]; // List of unclear aspects
}

export interface SchedulingContext {
    userId: string;
    workspaceId?: string;
    parsedIntent: ParsedIntent;

    // Time window to search
    searchWindowStart: string; // ISO
    searchWindowEnd: string; // ISO

    // User preferences
    workingHours?: {
        start: string; // "09:00"
        end: string; // "17:00"
        timezone?: string;
    };

    // Existing events to consider
    existingEvents?: any[];
    attendeeEvents?: Map<string, any[]>; // email -> events
}

export interface SuggestedSlot {
    id: string;
    startTime: string; // ISO
    endTime: string; // ISO
    score: number; // 0-100

    // Scoring breakdown
    scoreBreakdown: {
        availability: number; // 0-100
        preferenceMatch: number; // 0-100
        attendeeAvailability: number; // 0-100
        minimalDisruption: number; // 0-100
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
    severity: 'hard' | 'soft'; // hard = cannot overlap, soft = not ideal
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

export interface ScheduleRequest {
    slotId: string;
    parsedIntent: ParsedIntent;
    autoResolveConflicts?: boolean;
    notifyAttendees?: boolean;
}

export interface ScheduleResult {
    success: boolean;
    eventId?: string;
    movedEvents?: EventMove[];
    message: string;
}

/**
 * AI Provider Interface
 * Allows pluggable AI backends (OpenAI, Anthropic, Mock, etc.)
 */
export interface AIProvider {
    /**
     * Parse natural language into structured intent
     */
    parseIntent(prompt: string, context?: any): Promise<ParsedIntent>;

    /**
     * Generate time slot suggestions based on context
     */
    suggestSlots(context: SchedulingContext): Promise<SuggestedSlot[]>;

    /**
     * Generate clarifying question when intent is ambiguous
     */
    generateClarification(prompt: string, ambiguities: string[]): Promise<string>;
}

export type AIProviderType = 'openai' | 'anthropic' | 'gemini' | 'mock';
