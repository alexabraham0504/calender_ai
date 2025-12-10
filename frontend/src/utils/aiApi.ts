/**
 * AI API Service
 * HTTP client for AI-powered scheduling operations
 */

import { auth } from '../config/firebase';
import type {
    ParsedIntent,
    SuggestedSlot,
    AIResponse,
    ScheduleResult,
    AIStatus
} from '../types/ai';
import { logger } from './logger';

const API_URL = 'http://localhost:5000/api';

/**
 * Get authentication token from Firebase
 */
const getAuthToken = async (): Promise<string> => {
    const user = auth.currentUser;
    if (!user) {
        throw new Error('User not authenticated');
    }
    return await user.getIdToken();
};

/**
 * Parse natural language into structured intent
 */
export const parseIntent = async (prompt: string): Promise<AIResponse> => {
    try {
        logger.api('POST', '/api/ai/parse', undefined, undefined, {
            promptLength: prompt.length
        });

        const token = await getAuthToken();
        const response = await fetch(`${API_URL}/ai/parse`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ prompt })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to parse intent');
        }

        const data: AIResponse = await response.json();
        logger.success('Intent parsed successfully', {
            hasIntent: !!data.parsedIntent,
            needsClarification: data.clarificationNeeded
        });

        return data;
    } catch (error) {
        logger.error('Error parsing intent', error);
        throw error;
    }
};

/**
 * Get time slot suggestions based on parsed intent
 */
export const getSuggestions = async (
    parsedIntent: ParsedIntent,
    workspaceId?: string,
    searchWindowDays: number = 7
): Promise<SuggestedSlot[]> => {
    try {
        logger.api('POST', '/api/ai/suggest', undefined, undefined, {
            hasIntent: !!parsedIntent,
            workspaceId,
            searchWindowDays
        });

        const token = await getAuthToken();
        const response = await fetch(`${API_URL}/ai/suggest`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                parsedIntent,
                workspaceId,
                searchWindowDays
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to get suggestions');
        }

        const data: AIResponse = await response.json();
        logger.success('Suggestions received', {
            count: data.suggestions?.length || 0
        });

        return data.suggestions || [];
    } catch (error) {
        logger.error('Error getting suggestions', error);
        throw error;
    }
};

/**
 * Schedule event using selected slot
 */
export const scheduleEvent = async (
    selectedSlot: SuggestedSlot,
    parsedIntent: ParsedIntent,
    workspaceId?: string,
    autoResolveConflicts: boolean = false,
    notifyAttendees: boolean = false
): Promise<ScheduleResult> => {
    try {
        logger.api('POST', '/api/ai/schedule', undefined, undefined, {
            slotId: selectedSlot.id,
            autoResolve: autoResolveConflicts
        });

        const token = await getAuthToken();
        const response = await fetch(`${API_URL}/ai/schedule`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                slotId: selectedSlot.id,
                selectedSlot,
                parsedIntent,
                workspaceId,
                autoResolveConflicts,
                notifyAttendees
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to schedule event');
        }

        const data: ScheduleResult = await response.json();
        logger.success('Event scheduled successfully', {
            eventId: data.eventId,
            movedEvents: data.movedEvents?.length || 0
        });

        return data;
    } catch (error) {
        logger.error('Error scheduling event', error);
        throw error;
    }
};

/**
 * Get clarifying question for ambiguous input
 */
export const getClarification = async (
    prompt: string,
    ambiguities: string[]
): Promise<string> => {
    try {
        logger.api('POST', '/api/ai/clarify', undefined, undefined, {
            promptLength: prompt.length,
            ambiguities: ambiguities.length
        });

        const token = await getAuthToken();
        const response = await fetch(`${API_URL}/ai/clarify`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ prompt, ambiguities })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to get clarification');
        }

        const data: AIResponse = await response.json();
        logger.success('Clarification received');

        return data.clarificationQuestion || 'Could you provide more details?';
    } catch (error) {
        logger.error('Error getting clarification', error);
        throw error;
    }
};

/**
 * Get AI status and configuration
 */
export const getAIStatus = async (): Promise<AIStatus> => {
    try {
        logger.api('GET', '/api/ai/status');

        const token = await getAuthToken();
        const response = await fetch(`${API_URL}/ai/status`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to get AI status');
        }

        const data: AIStatus = await response.json();
        logger.success('AI status retrieved', {
            enabled: data.enabled,
            provider: data.provider
        });

        return data;
    } catch (error) {
        logger.error('Error getting AI status', error);
        throw error;
    }
};

/**
 * Helper: Format slot time for display
 */
export const formatSlotTime = (slot: SuggestedSlot): string => {
    const start = new Date(slot.startTime);
    const end = new Date(slot.endTime);

    const dateStr = start.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
    });

    const startTime = start.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });

    const endTime = end.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });

    return `${dateStr} at ${startTime} - ${endTime}`;
};

/**
 * Helper: Get slot quality tier
 */
export const getSlotQuality = (score: number): 'excellent' | 'good' | 'fair' | 'poor' => {
    if (score >= 90) return 'excellent';
    if (score >= 75) return 'good';
    if (score >= 60) return 'fair';
    return 'poor';
};

/**
 * Helper: Get quality color
 */
export const getQualityColor = (quality: 'excellent' | 'good' | 'fair' | 'poor'): string => {
    switch (quality) {
        case 'excellent': return 'text-green-600 dark:text-green-400';
        case 'good': return 'text-blue-600 dark:text-blue-400';
        case 'fair': return 'text-yellow-600 dark:text-yellow-400';
        case 'poor': return 'text-red-600 dark:text-red-400';
    }
};
