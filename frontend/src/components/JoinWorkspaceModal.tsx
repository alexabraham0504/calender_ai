/**
 * Join Workspace Modal Component
 * Modal dialog for joining an existing workspace via invite code
 */

import React, { useState } from 'react';
import { joinWorkspace } from '../utils/workspaceApi';
import { logger } from '../utils/logger';
import type { Workspace } from '../types/workspace';

interface JoinWorkspaceModalProps {
    isOpen: boolean;
    onClose: () => void;
    onWorkspaceJoined: (workspace: Workspace) => void;
}

const JoinWorkspaceModal: React.FC<JoinWorkspaceModalProps> = ({
    isOpen,
    onClose,
    onWorkspaceJoined
}) => {
    const [inviteCode, setInviteCode] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validation
        const cleanCode = inviteCode.trim().toUpperCase();

        if (!cleanCode) {
            setError('Invite code is required');
            return;
        }

        if (!/^[A-F0-9]{8}$/i.test(cleanCode)) {
            setError('Invalid invite code format (should be 8 characters)');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            logger.userAction('Joining workspace', { inviteCode: cleanCode });
            const workspace = await joinWorkspace(cleanCode);

            logger.success('Joined workspace', workspace);
            onWorkspaceJoined(workspace);

            // Reset form
            setInviteCode('');
            onClose();
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to join workspace';
            logger.error('Failed to join workspace', err);
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        if (!isLoading) {
            setInviteCode('');
            setError(null);
            onClose();
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        // Auto-format to uppercase and limit to 8 characters
        const value = e.target.value.toUpperCase().replace(/[^A-F0-9]/g, '').slice(0, 8);
        setInviteCode(value);
        setError(null);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-green-500 to-teal-600 px-6 py-4">
                    <h2 className="text-2xl font-bold text-white">Join Workspace</h2>
                    <p className="text-green-100 text-sm mt-1">
                        Enter the invite code to join an existing workspace
                    </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6">
                    <div className="mb-6">
                        <label
                            htmlFor="inviteCode"
                            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                        >
                            Invite Code
                        </label>
                        <input
                            type="text"
                            id="inviteCode"
                            value={inviteCode}
                            onChange={handleInputChange}
                            placeholder="XXXXXXXX"
                            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg 
                                     focus:ring-2 focus:ring-green-500 focus:border-transparent
                                     dark:bg-gray-700 dark:text-white
                                     font-mono text-lg tracking-widest text-center
                                     transition-all duration-200"
                            disabled={isLoading}
                            autoFocus
                            maxLength={8}
                        />
                        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 text-center">
                            8-character code (letters A-F and numbers 0-9)
                        </p>
                        {error && (
                            <p className="mt-2 text-sm text-red-600 dark:text-red-400 flex items-center justify-center">
                                <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                                {error}
                            </p>
                        )}
                    </div>

                    {/* Info Box */}
                    <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                        <div className="flex items-start">
                            <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                            </svg>
                            <p className="text-sm text-blue-800 dark:text-blue-300">
                                Ask the workspace owner for the invite code. You'll be added as a member and can view and create events.
                            </p>
                        </div>
                    </div>

                    {/* Buttons */}
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={handleClose}
                            disabled={isLoading}
                            className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 
                                     text-gray-700 dark:text-gray-300 rounded-lg font-medium
                                     hover:bg-gray-50 dark:hover:bg-gray-700
                                     disabled:opacity-50 disabled:cursor-not-allowed
                                     transition-all duration-200"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading || inviteCode.length !== 8}
                            className="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-teal-600 
                                     text-white rounded-lg font-medium
                                     hover:from-green-600 hover:to-teal-700
                                     disabled:opacity-50 disabled:cursor-not-allowed
                                     transition-all duration-200
                                     flex items-center justify-center gap-2"
                        >
                            {isLoading ? (
                                <>
                                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    Joining...
                                </>
                            ) : (
                                <>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                                    </svg>
                                    Join Workspace
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default JoinWorkspaceModal;
