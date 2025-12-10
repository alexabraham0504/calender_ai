/**
 * AI Provider Adapter
 * Factory pattern for pluggable AI providers
 * Supports OpenAI, Anthropic, Mock, and custom providers
 */

import { AIProvider, AIProviderType } from '../types/ai';
import { MockAIAdapter } from './mockAdapter';
import { logger } from '../utils/logger';

// Lazy-loaded providers
let openaiAdapter: AIProvider | null = null;
let anthropicAdapter: AIProvider | null = null;
let geminiAdapter: AIProvider | null = null;
let mockAdapter: AIProvider | null = null;

/**
 * Get AI provider instance based on configuration
 */
export function getAIProvider(type?: AIProviderType): AIProvider {
    const providerType = type || (process.env.AI_PROVIDER as AIProviderType) || 'mock';

    logger.debug('Getting AI provider', { type: providerType });

    switch (providerType) {
        case 'openai':
            return getOpenAIProvider();

        case 'anthropic':
            return getAnthropicProvider();

        case 'gemini':
            return getGeminiProvider();

        case 'mock':
        default:
            return getMockProvider();
    }
}

/**
 * Get OpenAI provider (lazy-loaded)
 */
function getOpenAIProvider(): AIProvider {
    if (!openaiAdapter) {
        try {
            // Dynamic import to avoid loading if not needed
            const { OpenAIAdapter } = require('./openaiAdapter');
            openaiAdapter = new OpenAIAdapter();
            logger.info('OpenAI adapter initialized');
        } catch (error) {
            logger.error('Failed to initialize OpenAI adapter, falling back to mock', error);
            return getMockProvider();
        }
    }
    return openaiAdapter!;
}

/**
 * Get Anthropic provider (lazy-loaded)
 */
function getAnthropicProvider(): AIProvider {
    if (!anthropicAdapter) {
        try {
            // Dynamic import to avoid loading if not needed
            const { AnthropicAdapter } = require('./anthropicAdapter');
            anthropicAdapter = new AnthropicAdapter();
            logger.info('Anthropic adapter initialized');
        } catch (error) {
            logger.error('Failed to initialize Anthropic adapter, falling back to mock', error);
            return getMockProvider();
        }
    }
    return anthropicAdapter!;
}

/**
 * Get Gemini provider (lazy-loaded)
 */
function getGeminiProvider(): AIProvider {
    if (!geminiAdapter) {
        try {
            // Dynamic import to avoid loading if not needed
            const { GeminiAdapter } = require('./geminiAdapter');
            geminiAdapter = new GeminiAdapter();
            logger.info('Gemini adapter initialized');
        } catch (error) {
            logger.error('Failed to initialize Gemini adapter, falling back to mock', error);
            return getMockProvider();
        }
    }
    return geminiAdapter!;
}

/**
 * Get Mock provider (always available)
 */
function getMockProvider(): AIProvider {
    if (!mockAdapter) {
        mockAdapter = new MockAIAdapter();
        logger.info('Mock adapter initialized');
    }
    return mockAdapter;
}

/**
 * Check if AI features are enabled
 */
export function isAIEnabled(): boolean {
    const enabled = process.env.AI_FEATURES_ENABLED === 'true';

    if (!enabled) {
        logger.warn('AI features are disabled via environment variable');
    }

    return enabled;
}

/**
 * Validate AI provider configuration
 */
export function validateAIConfig(): {
    valid: boolean;
    errors: string[];
} {
    const errors: string[] = [];
    const providerType = process.env.AI_PROVIDER || 'mock';

    // Check if AI is enabled
    if (!isAIEnabled()) {
        errors.push('AI features are disabled (AI_FEATURES_ENABLED=false)');
    }

    // Validate provider-specific config
    if (providerType === 'openai') {
        if (!process.env.OPENAI_API_KEY) {
            errors.push('OPENAI_API_KEY is required when AI_PROVIDER=openai');
        }
    }

    if (providerType === 'anthropic') {
        if (!process.env.ANTHROPIC_API_KEY) {
            errors.push('ANTHROPIC_API_KEY is required when AI_PROVIDER=anthropic');
        }
    }

    const valid = errors.length === 0;

    if (!valid) {
        logger.warn('AI configuration validation failed', { errors });
    }

    return { valid, errors };
}

/**
 * Get AI provider info
 */
export function getAIProviderInfo(): {
    type: string;
    enabled: boolean;
    configured: boolean;
} {
    const type = process.env.AI_PROVIDER || 'mock';
    const enabled = isAIEnabled();
    const { valid } = validateAIConfig();

    return {
        type,
        enabled,
        configured: valid
    };
}
