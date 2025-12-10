import React, { useState, type KeyboardEvent } from 'react';
import { parseIntent } from '../utils/aiApi';
import { logger } from '../utils/logger';
import type { AIResponse } from '../types/ai';

interface SmartComposeInputProps {
    onIntentParsed: (response: AIResponse) => void;
    onClarificationNeeded: (question: string) => void;
    className?: string;
    placeholder?: string;
}

const SmartComposeInput: React.FC<SmartComposeInputProps> = ({
    onIntentParsed,
    onClarificationNeeded,
    className = '',
    placeholder = "✨ Describe your event (e.g., 'Meeting with Team tomorrow at 10am')"
}) => {
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async () => {
        if (!input.trim()) return;

        setIsLoading(true);
        setError(null);

        try {
            logger.info('Submitting smart compose input', { length: input.length });
            const response = await parseIntent(input);

            if (response.success) {
                if (response.clarificationNeeded && response.clarificationQuestion) {
                    onClarificationNeeded(response.clarificationQuestion);
                } else {
                    onIntentParsed(response);
                    setInput(''); // Clear input on success
                }
            } else {
                // Show the error from the API
                setError(response.error || 'Failed to understand request');
            }
        } catch (err: any) {
            logger.error('Error in smart compose submit', err);

            // Provide user-friendly error messages
            let errorMessage = 'Something went wrong. Please try again.';

            if (err.message?.includes('rate limited') || err.message?.includes('429') || err.message?.includes('quota')) {
                errorMessage = '⏱️ AI is rate limited. Please wait a moment and try again.';
            } else if (err.message?.includes('not properly configured') || err.message?.includes('API key')) {
                errorMessage = '⚙️ AI service needs configuration. Please contact support.';
            } else if (err.message?.includes('network') || err.message?.includes('Failed to fetch')) {
                errorMessage = '📡 Connection issue. Check your internet and try again.';
            } else if (err.message) {
                errorMessage = err.message;
            }

            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    return (
        <div className={`relative w-full ${className}`}>
            <div className="relative flex items-center">
                <div className="absolute left-4 text-purple-500 animate-pulse">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
                    </svg>
                </div>
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={isLoading}
                    className="w-full h-12 pl-12 pr-12 text-base bg-white dark:bg-gray-800 border-2 border-transparent focus:border-purple-500 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-900 transition-all placeholder-gray-400 dark:placeholder-gray-500 text-gray-900 dark:text-white"
                    placeholder={placeholder}
                />
                <button
                    onClick={handleSubmit}
                    disabled={!input.trim() || isLoading}
                    className="absolute right-2 p-2 rounded-lg text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    {isLoading ? (
                        <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="22" y1="2" x2="11" y2="13"></line>
                            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                        </svg>
                    )}
                </button>
            </div>

            {error && (
                <div className="absolute -bottom-6 left-0 text-xs text-red-500 ml-1">
                    {error}
                </div>
            )}

            <div className="absolute right-0 -bottom-6 text-xs text-gray-400">
                Press Enter to schedule with AI
            </div>
        </div>
    );
};

export default SmartComposeInput;
