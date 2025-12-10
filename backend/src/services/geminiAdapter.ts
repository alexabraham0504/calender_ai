/**
 * Google Gemini Provider Adapter
 * Uses Google's Gemini 2.0 Flash (FREE with generous limits!)
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { AIProvider, ParsedIntent, SchedulingContext, SuggestedSlot } from '../types/ai';
import { logger } from '../utils/logger';
import { findAvailableSlots } from './schedulerService';

export class GeminiAdapter implements AIProvider {
    private genAI: GoogleGenerativeAI;
    private model: any;
    private readonly MAX_RETRIES = 3;
    private readonly INITIAL_DELAY = 1000; // 1 second

    constructor() {
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey || apiKey === 'your-gemini-key-here') {
            throw new Error('GEMINI_API_KEY is not configured. Get free key at: https://aistudio.google.com/app/apikey');
        }

        this.genAI = new GoogleGenerativeAI(apiKey);
        this.model = this.genAI.getGenerativeModel({
            model: 'gemini-2.0-flash-exp' // Latest free model
        });

        logger.info('Gemini adapter initialized with gemini-2.0-flash-exp');
    }

    /**
     * Helper: Retry with exponential backoff
     */
    private async retryWithBackoff<T>(
        fn: () => Promise<T>,
        retries: number = this.MAX_RETRIES
    ): Promise<T> {
        let lastError: any;

        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                return await fn();
            } catch (error: any) {
                lastError = error;

                // Check if error is rate limit related
                const isRateLimit = error.message?.includes('429') ||
                    error.message?.includes('quota') ||
                    error.message?.includes('rate limit') ||
                    error.message?.includes('RESOURCE_EXHAUSTED');

                if (attempt < retries && isRateLimit) {
                    const delay = this.INITIAL_DELAY * Math.pow(2, attempt);
                    logger.warn(`Rate limit hit, retrying in ${delay}ms (attempt ${attempt + 1}/${retries})`, {
                        error: error.message
                    });
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    throw error;
                }
            }
        }

        throw lastError;
    }

    /**
     * Parse intent using Gemini
     */
    async parseIntent(prompt: string, context?: any): Promise<ParsedIntent> {
        try {
            logger.debug('Gemini: Parsing intent', { promptLength: prompt.length });

            const systemPrompt = `You are a calendar scheduling assistant. Parse the user's request into structured JSON.

Extract:
- title: Event title
- description: Additional details
- startDate: ISO 8601 date-time string
- duration: Duration in minutes (default 60)
- attendees: Array of names/emails
- location: Location if mentioned
- priority: 'low', 'medium', or 'high'
- isFlexible: Boolean (can event be moved?)

Context:
- Current time: ${new Date().toISOString()}
- Timezone: ${context?.timezone || 'UTC'}

Respond with ONLY valid JSON, no markdown formatting.

Example output:
{
  "title": "Team Meeting",
  "startDate": "2025-12-10T14:00:00Z",
  "duration": 60,
  "priority": "medium",
  "isFlexible": true
}`;

            // Use retry mechanism for API call
            const result = await this.retryWithBackoff(async () => {
                return await this.model.generateContent([
                    systemPrompt,
                    `User request: ${prompt}`
                ]);
            });

            const response = await result.response;
            let text = response.text();

            // Remove markdown code blocks if present
            text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

            const parsed = JSON.parse(text);

            // Build ParsedIntent
            const intent: ParsedIntent = {
                title: parsed.title,
                description: parsed.description,
                startDate: parsed.startDate,
                duration: parsed.duration || 60,
                attendees: parsed.attendees || [],
                location: parsed.location,
                priority: parsed.priority || 'medium',
                isFlexible: parsed.isFlexible !== false,
                confidence: 0.9,
                ambiguities: []
            };

            // Check for ambiguities
            if (!intent.startDate) {
                intent.ambiguities?.push('start_time');
            }
            if (!intent.title) {
                intent.ambiguities?.push('title');
            }

            // Handle recurrence
            if (parsed.recurrence) {
                intent.recurrence = {
                    frequency: parsed.recurrence.frequency,
                    interval: parsed.recurrence.interval,
                    daysOfWeek: parsed.recurrence.daysOfWeek
                };
            }

            logger.success('Gemini: Intent parsed successfully', {
                title: intent.title,
                confidence: intent.confidence
            });

            return intent;
        } catch (error) {
            logger.error('Gemini: Error parsing intent', error);
            throw error;
        }
    }

    /**
     * Generate suggestions using core scheduler
     */
    async suggestSlots(context: SchedulingContext): Promise<SuggestedSlot[]> {
        try {
            logger.debug('Gemini: Generating slot suggestions');

            // Use our core scheduler
            const slots = await findAvailableSlots(context);

            logger.success('Gemini: Suggestions generated', { count: slots.length });
            return slots;
        } catch (error) {
            logger.error('Gemini: Error generating suggestions', error);
            throw error;
        }
    }

    /**
     * Generate clarifying question using Gemini
     */
    async generateClarification(prompt: string, ambiguities: string[]): Promise<string> {
        try {
            logger.debug('Gemini: Generating clarification', { ambiguities });

            const systemPrompt = `You are a helpful calendar assistant. The user's request is missing information: ${ambiguities.join(', ')}.

Ask a friendly, conversational question to get the missing details. Be brief and helpful.`;

            const result = await this.retryWithBackoff(async () => {
                return await this.model.generateContent([
                    systemPrompt,
                    `Original request: "${prompt}"`
                ]);
            });

            const response = await result.response;
            const question = response.text() ||
                'Could you provide more details about when you want to schedule this event?';

            logger.success('Gemini: Clarification generated');
            return question;
        } catch (error) {
            logger.error('Gemini: Error generating clarification', error);
            return 'Could you provide more details about when you want to schedule this event?';
        }
    }
}
