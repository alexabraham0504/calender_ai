/**
 * AI Controller
 * HTTP handlers for AI-powered scheduling endpoints
 */

import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { getAIProvider, isAIEnabled } from '../services/aiProviderAdapter';
import { findAvailableSlots, scheduleEvent } from '../services/schedulerService';
import {
    ParsedIntent,
    SchedulingContext,
    ScheduleRequest,
    AIResponse
} from '../types/ai';

/**
 * Parse natural language into structured intent
 * @route POST /api/ai/parse
 */
export const parseIntent = async (req: AuthRequest, res: Response) => {
    try {
        const { prompt } = req.body;

        // Validation
        if (!prompt || typeof prompt !== 'string') {
            logger.warn('Invalid prompt in parse request');
            return res.status(400).json({
                success: false,
                error: 'Prompt is required and must be a string'
            });
        }

        // Check if AI is enabled
        if (!isAIEnabled()) {
            logger.warn('AI features are disabled');
            return res.status(403).json({
                success: false,
                error: 'AI features are not enabled'
            });
        }

        logger.debug('Parsing intent', {
            userId: req.user.uid,
            promptLength: prompt.length
        });

        // Get AI provider and parse
        const provider = getAIProvider();
        const parsedIntent = await provider.parseIntent(prompt, {
            userId: req.user.uid,
            timezone: req.user.timezone || 'UTC'
        });

        // Check if clarification is needed
        if (parsedIntent.ambiguities && parsedIntent.ambiguities.length > 0) {
            const clarification = await provider.generateClarification(
                prompt,
                parsedIntent.ambiguities
            );

            logger.info('Clarification needed', {
                ambiguities: parsedIntent.ambiguities
            });

            return res.json({
                success: true,
                parsedIntent,
                clarificationNeeded: true,
                clarificationQuestion: clarification
            } as AIResponse);
        }

        logger.success('Intent parsed successfully', {
            title: parsedIntent.title,
            confidence: parsedIntent.confidence
        });

        res.json({
            success: true,
            parsedIntent,
            clarificationNeeded: false
        } as AIResponse);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to parse intent';
        logger.error('Error in parseIntent controller', error);

        // Determine error type and status code
        let statusCode = 500;
        let userMessage = errorMessage;

        if (errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('rate limit')) {
            statusCode = 429;
            userMessage = 'AI service is temporarily rate limited. Please try again in a few moments.';
        } else if (errorMessage.includes('GEMINI_API_KEY') || errorMessage.includes('API key')) {
            statusCode = 503;
            userMessage = 'AI service is not properly configured. Please contact support.';
        } else if (errorMessage.includes('network') || errorMessage.includes('ECONNREFUSED')) {
            statusCode = 503;
            userMessage = 'Unable to connect to AI service. Please check your internet connection.';
        }

        res.status(statusCode).json({
            success: false,
            error: userMessage,
            details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
        } as AIResponse);
    }
};

/**
 * Generate time slot suggestions
 * @route POST /api/ai/suggest
 */
export const suggestSlots = async (req: AuthRequest, res: Response) => {
    try {
        const {
            parsedIntent,
            workspaceId,
            searchWindowDays = 7
        } = req.body;

        // Validation
        if (!parsedIntent) {
            logger.warn('Missing parsedIntent in suggest request');
            return res.status(400).json({
                success: false,
                error: 'parsedIntent is required'
            });
        }

        // Check if AI is enabled
        if (!isAIEnabled()) {
            logger.warn('AI features are disabled');
            return res.status(403).json({
                success: false,
                error: 'AI features are not enabled'
            });
        }

        logger.debug('Generating slot suggestions', {
            userId: req.user.uid,
            workspaceId,
            searchWindowDays
        });

        // Build scheduling context
        const now = new Date();
        const searchWindowStart = parsedIntent.startDate || now.toISOString();
        const searchWindowEnd = new Date(
            new Date(searchWindowStart).getTime() + searchWindowDays * 24 * 60 * 60 * 1000
        ).toISOString();

        const context: SchedulingContext = {
            userId: req.user.uid,
            workspaceId,
            parsedIntent: parsedIntent as ParsedIntent,
            searchWindowStart,
            searchWindowEnd,
            workingHours: {
                start: process.env.WORKING_HOURS_START || '09:00',
                end: process.env.WORKING_HOURS_END || '17:00',
                timezone: req.user.timezone || 'UTC'
            }
        };

        // Find available slots
        const suggestions = await findAvailableSlots(context);

        logger.success('Slot suggestions generated', {
            count: suggestions.length
        });

        res.json({
            success: true,
            suggestions
        } as AIResponse);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to generate suggestions';
        logger.error('Error in suggestSlots controller', error);

        res.status(500).json({
            success: false,
            error: errorMessage
        } as AIResponse);
    }
};

/**
 * Schedule event using selected slot
 * @route POST /api/ai/schedule
 */
export const scheduleWithAI = async (req: AuthRequest, res: Response) => {
    try {
        const {
            slotId,
            parsedIntent,
            selectedSlot,
            workspaceId,
            autoResolveConflicts = false,
            notifyAttendees = false
        } = req.body as ScheduleRequest & any;

        // Validation
        if (!selectedSlot || !parsedIntent) {
            logger.warn('Missing required fields in schedule request');
            return res.status(400).json({
                success: false,
                message: 'selectedSlot and parsedIntent are required'
            });
        }

        // Check if AI is enabled
        if (!isAIEnabled()) {
            logger.warn('AI features are disabled');
            return res.status(403).json({
                success: false,
                message: 'AI features are not enabled'
            });
        }

        logger.debug('Scheduling event with AI', {
            userId: req.user.uid,
            slotId,
            autoResolve: autoResolveConflicts
        });

        // Schedule the event
        const result = await scheduleEvent(
            selectedSlot,
            parsedIntent as ParsedIntent,
            req.user.uid,
            workspaceId,
            autoResolveConflicts
        );

        // TODO: Send notifications if requested
        if (notifyAttendees && parsedIntent.attendees) {
            logger.info('Attendee notifications requested', {
                attendees: parsedIntent.attendees.length
            });
            // Implement notification service call here
        }

        logger.success('Event scheduled successfully', {
            eventId: result.eventId,
            movedEvents: result.movedEvents.length
        });

        res.json({
            success: true,
            eventId: result.eventId,
            movedEvents: result.movedEvents,
            message: 'Event scheduled successfully'
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to schedule event';
        logger.error('Error in scheduleWithAI controller', error);

        res.status(500).json({
            success: false,
            message: errorMessage
        });
    }
};

/**
 * Generate clarifying question
 * @route POST /api/ai/clarify
 */
export const getClarification = async (req: AuthRequest, res: Response) => {
    try {
        const { prompt, ambiguities } = req.body;

        // Validation
        if (!prompt || !ambiguities) {
            logger.warn('Missing required fields in clarify request');
            return res.status(400).json({
                success: false,
                error: 'prompt and ambiguities are required'
            });
        }

        // Check if AI is enabled
        if (!isAIEnabled()) {
            logger.warn('AI features are disabled');
            return res.status(403).json({
                success: false,
                error: 'AI features are not enabled'
            });
        }

        logger.debug('Generating clarification', {
            userId: req.user.uid,
            ambiguities: ambiguities.length
        });

        // Get AI provider and generate clarification
        const provider = getAIProvider();
        const clarificationQuestion = await provider.generateClarification(
            prompt,
            ambiguities
        );

        logger.success('Clarification generated');

        res.json({
            success: true,
            clarificationQuestion
        } as AIResponse);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to generate clarification';
        logger.error('Error in getClarification controller', error);

        res.status(500).json({
            success: false,
            error: errorMessage
        } as AIResponse);
    }
};

/**
 * Get AI provider status and configuration
 * @route GET /api/ai/status
 */
export const getAIStatus = async (req: AuthRequest, res: Response) => {
    try {
        const enabled = isAIEnabled();
        const providerType = process.env.AI_PROVIDER || 'mock';

        logger.debug('AI status requested', { userId: req.user.uid });

        res.json({
            success: true,
            enabled,
            provider: providerType,
            features: {
                parsing: enabled,
                suggestions: enabled,
                autoSchedule: enabled
            }
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to get AI status';
        logger.error('Error in getAIStatus controller', error);

        res.status(500).json({
            success: false,
            error: errorMessage
        });
    }
};
