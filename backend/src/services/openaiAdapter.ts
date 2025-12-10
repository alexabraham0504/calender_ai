/**
 * OpenAI Provider Adapter
 * Uses OpenAI GPT-4 for intelligent intent parsing and scheduling
 */

import OpenAI from 'openai';
import { AIProvider, ParsedIntent, SchedulingContext, SuggestedSlot } from '../types/ai';
import { logger } from '../utils/logger';
import { findAvailableSlots } from './schedulerService';

export class OpenAIAdapter implements AIProvider {
    private client: OpenAI;

    constructor() {
        const apiKey = process.env.OPENAI_API_KEY;

        if (!apiKey || apiKey === 'sk-your-key-here-replace-this') {
            throw new Error('OPENAI_API_KEY is not configured. Please add your API key to .env file.');
        }

        this.client = new OpenAI({
            apiKey: apiKey
        });

        logger.info('OpenAI adapter initialized');
    }

    /**
     * Parse intent using OpenAI GPT-4
     */
    async parseIntent(prompt: string, context?: any): Promise<ParsedIntent> {
        try {
            logger.debug('OpenAI: Parsing intent with GPT-4', { promptLength: prompt.length });

            const systemPrompt = `You are a calendar scheduling assistant. Parse the user's natural language request into structured event data.

Extract the following information:
- title: Event title/summary
- description: Additional details (if any)
- startDate: ISO 8601 date-time string
- duration: Duration in minutes
- attendees: Array of email addresses or names
- location: Physical or virtual location
- priority: 'low', 'medium', or 'high'
- recurrence: For recurring events (frequency, interval, daysOfWeek)
- isFlexible: Boolean - can this event be moved if needed?

Current context:
- Today is ${new Date().toISOString()}
- Timezone: ${context?.timezone || 'UTC'}

Respond with valid JSON only.`;

            const response = await this.client.chat.completions.create({
                model: 'gpt-4o-mini', // Using gpt-4o-mini (affordable and fast)
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: prompt }
                ],
                response_format: { type: 'json_object' },
                temperature: 0.3,
                max_tokens: 500
            });

            const content = response.choices[0]?.message?.content;
            if (!content) {
                throw new Error('No response from OpenAI');
            }

            const parsed = JSON.parse(content);

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

            logger.success('OpenAI: Intent parsed successfully', {
                title: intent.title,
                confidence: intent.confidence
            });

            return intent;
        } catch (error) {
            logger.error('OpenAI: Error parsing intent', error);
            throw error;
        }
    }

    /**
     * Generate suggestions using core scheduler + OpenAI reasoning
     */
    async suggestSlots(context: SchedulingContext): Promise<SuggestedSlot[]> {
        try {
            logger.debug('OpenAI: Generating slot suggestions');

            // Use our core scheduler to find slots
            const slots = await findAvailableSlots(context);

            // Optionally enhance with GPT-4 reasoning
            // For now, just return the scheduler's results
            logger.success('OpenAI: Suggestions generated', { count: slots.length });
            return slots;
        } catch (error) {
            logger.error('OpenAI: Error generating suggestions', error);
            throw error;
        }
    }

    /**
     * Generate clarifying question using GPT-4
     */
    async generateClarification(prompt: string, ambiguities: string[]): Promise<string> {
        try {
            logger.debug('OpenAI: Generating clarification', { ambiguities });

            const systemPrompt = `You are a helpful calendar assistant. The user's request is missing some information. Ask a clear, friendly question to get the missing details.

Missing information: ${ambiguities.join(', ')}

Be conversational and helpful. Ask for only the most critical missing piece.`;

            const response = await this.client.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: `Original request: "${prompt}"` }
                ],
                temperature: 0.7,
                max_tokens: 100
            });

            const question = response.choices[0]?.message?.content ||
                'Could you provide more details about when you want to schedule this event?';

            logger.success('OpenAI: Clarification generated');
            return question;
        } catch (error) {
            logger.error('OpenAI: Error generating clarification', error);
            return 'Could you provide more details about when you want to schedule this event?';
        }
    }
}
