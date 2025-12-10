import React from 'react';
import type { SuggestedSlot } from '../types/ai';
import { formatSlotTime, getSlotQuality, getQualityColor } from '../utils/aiApi';

interface SuggestionCardProps {
    slot: SuggestedSlot;
    isSelected: boolean;
    onSelect: (slot: SuggestedSlot) => void;
}

const SuggestionCard: React.FC<SuggestionCardProps> = ({
    slot,
    isSelected,
    onSelect
}) => {
    const quality = getSlotQuality(slot.score);
    const qualityColor = getQualityColor(quality);

    return (
        <div
            onClick={() => onSelect(slot)}
            className={`
                relative p-4 rounded-xl border-2 cursor-pointer transition-all duration-200
                ${isSelected
                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 shadow-md'
                    : 'border-gray-100 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-700 bg-white dark:bg-gray-800'
                }
            `}
        >
            <div className="flex justify-between items-start mb-2">
                <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 dark:text-white text-lg">
                        {formatSlotTime(slot)}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {slot.reason}
                    </p>
                </div>
                <div className="flex flex-col items-end">
                    <div className={`text-2xl font-bold ${qualityColor}`}>
                        {Math.round(slot.score)}%
                    </div>
                    <span className={`text-xs font-medium uppercase tracking-wider ${qualityColor}`}>
                        {quality}
                    </span>
                </div>
            </div>

            {/* Score Breakdown visualization */}
            <div className="mt-3 grid grid-cols-4 gap-1 h-1.5 w-full rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700">
                <div
                    className="bg-green-500 dark:bg-green-400"
                    style={{ width: `${slot.scoreBreakdown.availability}%`, opacity: 0.8 }}
                    title="Availability"
                />
                <div
                    className="bg-blue-500 dark:bg-blue-400"
                    style={{ width: `${slot.scoreBreakdown.preferenceMatch}%`, opacity: 0.8 }}
                    title="Preferences"
                />
                <div
                    className="bg-yellow-500 dark:bg-yellow-400"
                    style={{ width: `${slot.scoreBreakdown.attendeeAvailability}%`, opacity: 0.8 }}
                    title="Attendees"
                />
                <div
                    className="bg-purple-500 dark:bg-purple-400"
                    style={{ width: `${slot.scoreBreakdown.minimalDisruption}%`, opacity: 0.8 }}
                    title="Disruption"
                />
            </div>

            {/* Warnings/Conflicts */}
            {(slot.warnings.length > 0 || slot.conflicts.length > 0) && (
                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                    {slot.conflicts.length > 0 && (
                        <div className="flex items-center text-xs text-orange-600 dark:text-orange-400 mb-1">
                            <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <span>
                                {slot.conflicts.length} conflict{slot.conflicts.length > 1 ? 's' : ''} requires resolution
                            </span>
                        </div>
                    )}
                    {slot.warnings.map((warning, index) => (
                        <div key={index} className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 mr-2" />
                            {warning}
                        </div>
                    ))}
                </div>
            )}

            {isSelected && (
                <div className="absolute top-3 right-3">
                    <div className="w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SuggestionCard;
