import React, { useState, useEffect } from 'react';
import type { ParsedIntent, SuggestedSlot, ScheduleResult } from '../types/ai';
import { getSuggestions, scheduleEvent } from '../utils/aiApi';
import SuggestionCard from './SuggestionCard';
import { logger } from '../utils/logger';

interface AISuggestionsModalProps {
    isOpen: boolean;
    onClose: () => void;
    parsedIntent: ParsedIntent;
    workspaceId?: string;
    onScheduled: (result: ScheduleResult) => void;
}

const AISuggestionsModal: React.FC<AISuggestionsModalProps> = ({
    isOpen,
    onClose,
    parsedIntent,
    workspaceId,
    onScheduled
}) => {
    const [suggestions, setSuggestions] = useState<SuggestedSlot[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isScheduling, setIsScheduling] = useState(false);
    const [selectedSlot, setSelectedSlot] = useState<SuggestedSlot | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [autoResolve, setAutoResolve] = useState(false);

    // Fetch suggestions when modal opens
    useEffect(() => {
        if (isOpen && parsedIntent) {
            fetchSuggestions();
        }
    }, [isOpen, parsedIntent]);

    const fetchSuggestions = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const slots = await getSuggestions(parsedIntent, workspaceId);
            setSuggestions(slots);
            if (slots.length > 0) {
                setSelectedSlot(slots[0]); // Select top slot by default
            } else {
                setError('No suitable time slots found. Try adjusting your request.');
            }
        } catch (err) {
            logger.error('Error fetching suggestions', err);
            setError('Failed to load suggestions. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSchedule = async () => {
        if (!selectedSlot) return;

        setIsScheduling(true);
        try {
            const result = await scheduleEvent(
                selectedSlot,
                parsedIntent,
                workspaceId,
                autoResolve,
                true // notify attendees
            );

            onScheduled(result);
            onClose();
        } catch (err) {
            logger.error('Error scheduling event', err);
            setError('Failed to schedule event. Please try again.');
        } finally {
            setIsScheduling(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-white/50 dark:bg-gray-900/50 backdrop-blur-md sticky top-0 z-10">
                    <div>
                        <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-blue-600">
                            AI Suggested Times
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            Based on your preferences and availability
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                    >
                        <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {/* Event Preview */}
                    <div className="bg-purple-50 dark:bg-purple-900/10 p-4 rounded-xl mb-6">
                        <div className="flex items-center space-x-2 text-sm text-purple-700 dark:text-purple-300 mb-2 font-medium uppercase tracking-wider">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>Intent Preview</span>
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            {parsedIntent.title || 'Untitled Event'}
                        </h3>
                        <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-600 dark:text-gray-300">
                            {parsedIntent.duration && (
                                <div className="flex items-center">
                                    <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    {parsedIntent.duration} minutes
                                </div>
                            )}
                            {parsedIntent.attendees && parsedIntent.attendees.length > 0 && (
                                <div className="flex items-center">
                                    <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                    </svg>
                                    {parsedIntent.attendees.length} attendees
                                </div>
                            )}
                        </div>
                    </div>

                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-12">
                            <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mb-4" />
                            <p className="text-gray-500 text-sm animate-pulse">
                                Finding the best time slots...
                            </p>
                        </div>
                    ) : error ? (
                        <div className="text-center py-12">
                            <div className="bg-red-50 dark:bg-red-900/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                                We couldn't find any slots
                            </h3>
                            <p className="text-gray-500 max-w-xs mx-auto mb-6">
                                {error}
                            </p>
                            <button
                                onClick={fetchSuggestions}
                                className="text-purple-600 hover:text-purple-700 font-medium"
                            >
                                Try again
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {suggestions.map((slot) => (
                                <SuggestionCard
                                    key={slot.id}
                                    slot={slot}
                                    isSelected={selectedSlot?.id === slot.id}
                                    onSelect={setSelectedSlot}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 flex flex-col sm:flex-row gap-4 justify-between items-center">
                    {selectedSlot?.conflicts.length ? (
                        <label className="flex items-center space-x-2 text-sm cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={autoResolve}
                                onChange={(e) => setAutoResolve(e.target.checked)}
                                className="w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500 transition-colors"
                            />
                            <span className="text-gray-700 dark:text-gray-300">
                                Automatically resolve {selectedSlot.conflicts.length} conflicts
                            </span>
                        </label>
                    ) : <div />}

                    <div className="flex space-x-3 w-full sm:w-auto">
                        <button
                            onClick={onClose}
                            className="flex-1 sm:flex-none px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSchedule}
                            disabled={!selectedSlot || isLoading || isScheduling}
                            className="flex-1 sm:flex-none px-6 py-2.5 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-lg shadow-purple-500/20 transition-all flex items-center justify-center min-w-[120px]"
                        >
                            {isScheduling ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                            ) : null}
                            {isScheduling ? 'Scheduling...' : 'Schedule Event'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AISuggestionsModal;
