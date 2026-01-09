/**
 * @fileoverview AI Image Generation Adapter
 * @module services/aiImageAdapter
 * 
 * Provides abstraction layer for AI image generation providers.
 * Supports OpenAI DALL-E, Stability AI, and mock provider for testing.
 * 
 * Configuration via environment variables:
 * - AI_PROVIDER: 'openai' | 'stability' | 'mock'
 * - OPENAI_API_KEY: OpenAI API key
 * - STABILITY_API_KEY: Stability AI API key
 * 
 * Usage:
 *   import { generateAIImage } from './aiImageAdapter';
 *   const imageBuffer = await generateAIImage({ prompt: 'Calendar background', aspectRatio: '16:9' });
 */

import { OpenAI } from 'openai';
import { logger } from '../utils/logger';
import { AIImageGenerateRequest } from '../types/image';
import axios from 'axios';

const AI_PROVIDER = process.env.AI_PROVIDER || 'mock';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const STABILITY_API_KEY = process.env.STABILITY_API_KEY;

/**
 * Generate image using OpenAI DALL-E
 */
async function generateWithOpenAI(request: AIImageGenerateRequest): Promise<Buffer> {
    if (!OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY not configured');
    }

    try {
        const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

        // Map aspect ratio to DALL-E size
        const sizeMap: Record<string, '1024x1024' | '1792x1024' | '1024x1792'> = {
            '1:1': '1024x1024',
            '16:9': '1792x1024',
            '9:16': '1024x1792',
            '4:3': '1792x1024',
            '3:4': '1024x1792',
        };

        const size = sizeMap[request.aspectRatio || '1:1'] || '1024x1024';

        logger.info(`Generating image with OpenAI: ${request.prompt}`);

        const response = await openai.images.generate({
            model: 'dall-e-3',
            prompt: request.prompt,
            n: 1,
            size,
            quality: 'standard',
        });

        const imageUrl = response.data?.[0]?.url;
        if (!imageUrl) {
            throw new Error('No image URL returned from OpenAI');
        }

        // Download image
        const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        return Buffer.from(imageResponse.data);
    } catch (error: any) {
        logger.error('OpenAI image generation failed:', error);
        throw new Error(`OpenAI error: ${error.message}`);
    }
}

/**
 * Generate image using Stability AI
 */
async function generateWithStability(request: AIImageGenerateRequest): Promise<Buffer> {
    if (!STABILITY_API_KEY) {
        throw new Error('STABILITY_API_KEY not configured');
    }

    try {
        logger.info(`Generating image with Stability AI: ${request.prompt}`);

        // Map aspect ratio
        const aspectRatioMap: Record<string, string> = {
            '1:1': '1:1',
            '16:9': '16:9',
            '9:16': '9:16',
            '4:3': '4:3',
            '3:4': '3:4',
        };

        const response = await axios.post(
            'https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image',
            {
                text_prompts: [{ text: request.prompt }],
                cfg_scale: 7,
                height: 1024,
                width: 1024,
                samples: 1,
                steps: 30,
                style_preset: request.stylePreset || 'photographic',
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    Authorization: `Bearer ${STABILITY_API_KEY}`,
                },
            }
        );

        const image = response.data.artifacts?.[0];
        if (!image || !image.base64) {
            throw new Error('No image returned from Stability AI');
        }

        return Buffer.from(image.base64, 'base64');
    } catch (error: any) {
        logger.error('Stability AI image generation failed:', error);
        throw new Error(`Stability AI error: ${error.response?.data?.message || error.message}`);
    }
}

/**
 * Generate mock image for testing (colored rectangle with text)
 */
async function generateMockImage(request: AIImageGenerateRequest): Promise<Buffer> {
    logger.info(`Generating MOCK image: ${request.prompt}`);

    // Create a simple colored SVG
    const color = request.colorPalette?.[0] || '#4A90E2';
    const svg = `
    <svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
      <rect width="1024" height="1024" fill="${color}"/>
      <text x="50%" y="50%" text-anchor="middle" fill="white" font-size="24" font-family="Arial">
        ${request.prompt.substring(0, 50)}
      </text>
      <text x="50%" y="55%" text-anchor="middle" fill="white" font-size="16" font-family="Arial">
        (Mock AI Generated Image)
      </text>
    </svg>
  `;

    // Convert SVG to buffer (in production, use sharp or similar)
    return Buffer.from(svg, 'utf-8');
}

/**
 * Main function to generate AI image
 * Routes to appropriate provider based on AI_PROVIDER env variable
 * 
 * @param request - AI generation request
 * @returns Image buffer
 */
export async function generateAIImage(request: AIImageGenerateRequest): Promise<Buffer> {
    try {
        switch (AI_PROVIDER) {
            case 'openai':
                return await generateWithOpenAI(request);
            case 'stability':
                return await generateWithStability(request);
            case 'mock':
                return await generateMockImage(request);
            default:
                throw new Error(`Unknown AI provider: ${AI_PROVIDER}`);
        }
    } catch (error: any) {
        logger.error('AI image generation failed:', error);
        throw error;
    }
}

/**
 * Check if AI image generation is enabled and configured
 */
export function isAIImageEnabled(): boolean {
    switch (AI_PROVIDER) {
        case 'openai':
            return !!OPENAI_API_KEY;
        case 'stability':
            return !!STABILITY_API_KEY;
        case 'mock':
            return true;
        default:
            return false;
    }
}

/**
 * Get current AI provider name
 */
export function getAIProvider(): string {
    return AI_PROVIDER;
}
