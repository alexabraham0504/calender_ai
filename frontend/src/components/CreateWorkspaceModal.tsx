/**
 * Create Workspace Modal Component
 * Modal dialog for creating a new workspace
 */

import React, { useState } from 'react';
import { createWorkspace } from '../utils/workspaceApi';
import { logger } from '../utils/logger';
import type { Workspace } from '../types/workspace';

interface CreateWorkspaceModalProps {
    isOpen: boolean;
    onClose: () => void;
    onWorkspaceCreated: (workspace: Workspace) => void;
}

const CreateWorkspaceModal: React.FC<CreateWorkspaceModalProps> = ({
    isOpen,
    onClose,
    onWorkspaceCreated
}) => {
    const [workspaceName, setWorkspaceName] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validation
        if (!workspaceName.trim()) {
            setError('Workspace name is required');
            return;
        }

        if (workspaceName.length < 3) {
            setError('Workspace name must be at least 3 characters');
            return;
        }

        if (workspaceName.length > 50) {
            setError('Workspace name must be less than 50 characters');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            logger.userAction('Creating workspace', { name: workspaceName });
            const workspace = await createWorkspace(workspaceName);

            logger.success('Workspace created', workspace);
            onWorkspaceCreated(workspace);

            // Reset form
            setWorkspaceName('');
            onClose();
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to create workspace';
            logger.error('Failed to create workspace', err);
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        if (!isLoading) {
            setWorkspaceName('');
            setError(null);
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-500 to-purple-600 px-6 py-4">
                    <h2 className="text-2xl font-bold text-white">Create Workspace</h2>
                    <p className="text-blue-100 text-sm mt-1">
                        Create a new workspace to collaborate with your team
                    </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6">
                    <div className="mb-6">
                        <label
                            htmlFor="workspaceName"
                            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                        >
                            Workspace Name
                        </label>
                        <input
                            type="text"
                            id="workspaceName"
                            value={workspaceName}
                            onChange={(e) => {
                                setWorkspaceName(e.target.value);
                                setError(null);
                            }}
                            placeholder="e.g., Marketing Team, Project Alpha"
                            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg 
                                     focus:ring-2 focus:ring-blue-500 focus:border-transparent
                                     dark:bg-gray-700 dark:text-white
                                     transition-all duration-200"
                            disabled={isLoading}
                            autoFocus
                        />
                        {error && (
                            <p className="mt-2 text-sm text-red-600 dark:text-red-400 flex items-center">
                                <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                                {error}
                            </p>
                        )}
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
                            disabled={isLoading || !workspaceName.trim()}
                            className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-500 to-purple-600 
                                     text-white rounded-lg font-medium
                                     hover:from-blue-600 hover:to-purple-700
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
                                    Creating...
                                </>
                            ) : (
                                <>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                    Create Workspace
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateWorkspaceModal;
