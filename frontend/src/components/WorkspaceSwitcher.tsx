/**
 * Workspace Switcher Component
 * Dropdown component for switching between workspaces and managing workspace actions
 */

import React, { useState, useEffect, useRef } from 'react';
import { getUserWorkspaces } from '../utils/workspaceApi';
import { logger } from '../utils/logger';
import type { Workspace } from '../types/workspace';
import CreateWorkspaceModal from './CreateWorkspaceModal';
import JoinWorkspaceModal from './JoinWorkspaceModal';

interface WorkspaceSwitcherProps {
    activeWorkspace: Workspace | null;
    onWorkspaceChange: (workspace: Workspace | null) => void;
}

const WorkspaceSwitcher: React.FC<WorkspaceSwitcherProps> = ({
    activeWorkspace,
    onWorkspaceChange
}) => {
    const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showJoinModal, setShowJoinModal] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Load workspaces on mount
    useEffect(() => {
        loadWorkspaces();
    }, []);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const loadWorkspaces = async () => {
        try {
            setIsLoading(true);
            const fetchedWorkspaces = await getUserWorkspaces();
            setWorkspaces(fetchedWorkspaces);

            // If no active workspace and workspaces exist, set first as active
            if (!activeWorkspace && fetchedWorkspaces.length > 0) {
                onWorkspaceChange(fetchedWorkspaces[0]);
            }

            logger.success('Workspaces loaded', { count: fetchedWorkspaces.length });
        } catch (error) {
            logger.error('Failed to load workspaces', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleWorkspaceSelect = (workspace: Workspace) => {
        onWorkspaceChange(workspace);
        setIsOpen(false);
        logger.userAction('Switched workspace', { workspaceId: workspace.id, name: workspace.name });
    };

    const handlePersonalCalendar = () => {
        onWorkspaceChange(null);
        setIsOpen(false);
        logger.userAction('Switched to personal calendar');
    };

    const handleWorkspaceCreated = (workspace: Workspace) => {
        setWorkspaces([...workspaces, workspace]);
        onWorkspaceChange(workspace);
        logger.success('Workspace added to list', workspace);
    };

    const handleWorkspaceJoined = (workspace: Workspace) => {
        // Check if workspace already exists in list
        const exists = workspaces.some(w => w.id === workspace.id);
        if (!exists) {
            setWorkspaces([...workspaces, workspace]);
        }
        onWorkspaceChange(workspace);
        logger.success('Workspace joined and activated', workspace);
    };

    const copyInviteCode = (inviteCode: string, e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(inviteCode);
        logger.userAction('Copied invite code', { inviteCode });
        // You could add a toast notification here
    };

    return (
        <>
            <div className="relative" ref={dropdownRef}>
                {/* Workspace Button */}
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg
                             bg-white/10 hover:bg-white/20 backdrop-blur-sm
                             border border-white/20 hover:border-white/30
                             text-white transition-all duration-200
                             shadow-lg hover:shadow-xl"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    <span className="font-medium">
                        {activeWorkspace ? activeWorkspace.name : 'Personal Calendar'}
                    </span>
                    <svg
                        className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </button>

                {/* Dropdown Menu */}
                {isOpen && (
                    <div className="absolute top-full mt-2 right-0 w-80 bg-white dark:bg-gray-800 
                                  rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700
                                  overflow-hidden z-50">
                        {/* Personal Calendar Option */}
                        <div className="border-b border-gray-200 dark:border-gray-700">
                            <button
                                onClick={handlePersonalCalendar}
                                className={`w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700
                                          transition-colors duration-150 flex items-center gap-3
                                          ${!activeWorkspace ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                            >
                                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-400 to-blue-600 
                                              flex items-center justify-center flex-shrink-0">
                                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                </div>
                                <div className="flex-1">
                                    <div className="font-medium text-gray-900 dark:text-white">Personal Calendar</div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">Your private events</div>
                                </div>
                                {!activeWorkspace && (
                                    <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                )}
                            </button>
                        </div>

                        {/* Workspaces List */}
                        <div className="max-h-64 overflow-y-auto">
                            {isLoading ? (
                                <div className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                                    <svg className="animate-spin h-8 w-8 mx-auto mb-2" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    Loading workspaces...
                                </div>
                            ) : workspaces.length === 0 ? (
                                <div className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                                    <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                    </svg>
                                    <p className="text-sm">No workspaces yet</p>
                                    <p className="text-xs mt-1">Create or join a workspace to collaborate</p>
                                </div>
                            ) : (
                                workspaces.map((workspace) => (
                                    <button
                                        key={workspace.id}
                                        onClick={() => handleWorkspaceSelect(workspace)}
                                        className={`w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700
                                                  transition-colors duration-150 flex items-center gap-3
                                                  ${activeWorkspace?.id === workspace.id ? 'bg-purple-50 dark:bg-purple-900/20' : ''}`}
                                    >
                                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-400 to-pink-600 
                                                      flex items-center justify-center flex-shrink-0">
                                            <span className="text-white font-bold text-lg">
                                                {workspace.name.charAt(0).toUpperCase()}
                                            </span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium text-gray-900 dark:text-white truncate">
                                                {workspace.name}
                                            </div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
                                                <span>{workspace.members.length} member{workspace.members.length !== 1 ? 's' : ''}</span>
                                                <span>•</span>
                                                <button
                                                    onClick={(e) => copyInviteCode(workspace.inviteCode, e)}
                                                    className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                                    title="Copy invite code"
                                                >
                                                    Code: {workspace.inviteCode}
                                                </button>
                                            </div>
                                        </div>
                                        {activeWorkspace?.id === workspace.id && (
                                            <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                            </svg>
                                        )}
                                    </button>
                                ))
                            )}
                        </div>

                        {/* Action Buttons */}
                        <div className="border-t border-gray-200 dark:border-gray-700 p-2 bg-gray-50 dark:bg-gray-900/50">
                            <button
                                onClick={() => {
                                    setShowCreateModal(true);
                                    setIsOpen(false);
                                }}
                                className="w-full px-4 py-2 mb-2 text-left hover:bg-white dark:hover:bg-gray-800
                                         rounded-lg transition-colors duration-150 flex items-center gap-2
                                         text-blue-600 dark:text-blue-400 font-medium"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                Create Workspace
                            </button>
                            <button
                                onClick={() => {
                                    setShowJoinModal(true);
                                    setIsOpen(false);
                                }}
                                className="w-full px-4 py-2 text-left hover:bg-white dark:hover:bg-gray-800
                                         rounded-lg transition-colors duration-150 flex items-center gap-2
                                         text-green-600 dark:text-green-400 font-medium"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                        d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                                </svg>
                                Join Workspace
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Modals */}
            <CreateWorkspaceModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                onWorkspaceCreated={handleWorkspaceCreated}
            />
            <JoinWorkspaceModal
                isOpen={showJoinModal}
                onClose={() => setShowJoinModal(false)}
                onWorkspaceJoined={handleWorkspaceJoined}
            />
        </>
    );
};

export default WorkspaceSwitcher;
