/**
 * Workspace Settings Component
 * Comprehensive settings interface for workspace management with tabs for members, roles, and invite code
 */

import React, { useState, useEffect } from 'react';
import { auth } from '../config/firebase';
import type { Workspace, WorkspaceMember } from '../types/workspace';
import type { WorkspaceRole } from '../types/roles';
import { getRolePermissions } from '../types/roles';
import { updateMemberRole, removeMember } from '../utils/roleApi';
import { logger } from '../utils/logger';
import RoleBadge from './RoleBadge';
import MemberRoleDropdown from './MemberRoleDropdown';

interface WorkspaceSettingsProps {
    workspace: Workspace;
    onWorkspaceUpdate: (workspace: Workspace) => void;
    onClose: () => void;
}

type TabType = 'members' | 'roles' | 'invite';

const WorkspaceSettings: React.FC<WorkspaceSettingsProps> = ({
    workspace,
    onWorkspaceUpdate,
    onClose
}) => {
    const [activeTab, setActiveTab] = useState<TabType>('members');
    const [members, setMembers] = useState<WorkspaceMember[]>(workspace.members);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [currentUserRole, setCurrentUserRole] = useState<WorkspaceRole>('viewer');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [copiedCode, setCopiedCode] = useState(false);

    useEffect(() => {
        const user = auth.currentUser;
        setCurrentUser(user);

        if (user) {
            const member = workspace.members.find(m => m.uid === user.uid);
            if (member) {
                setCurrentUserRole(member.role);
            }
        }
    }, [workspace]);

    useEffect(() => {
        setMembers(workspace.members);
    }, [workspace.members]);

    const permissions = getRolePermissions(currentUserRole);

    const handleRoleChange = async (targetUserId: string, newRole: WorkspaceRole) => {
        setIsLoading(true);
        setError(null);

        try {
            const updatedWorkspace = await updateMemberRole(workspace.id, targetUserId, newRole);
            setMembers(updatedWorkspace.members);
            onWorkspaceUpdate(updatedWorkspace);
            logger.success('Role updated successfully');
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to update role';
            setError(errorMessage);
            logger.error('Failed to update role', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleRemoveMember = async (targetUserId: string, memberName: string) => {
        if (!confirm(`Are you sure you want to remove ${memberName} from this workspace?`)) {
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const updatedWorkspace = await removeMember(workspace.id, targetUserId);
            setMembers(updatedWorkspace.members);
            onWorkspaceUpdate(updatedWorkspace);
            logger.success('Member removed successfully');
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to remove member';
            setError(errorMessage);
            logger.error('Failed to remove member', err);
        } finally {
            setIsLoading(false);
        }
    };

    const copyInviteCode = () => {
        navigator.clipboard.writeText(workspace.inviteCode);
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2000);
        logger.userAction('Copied invite code', { code: workspace.inviteCode });
    };

    const renderMembersTab = () => (
        <div className="space-y-4">
            {/* Members Table */}
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                                Member
                            </th>
                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                                Role
                            </th>
                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                                Joined
                            </th>
                            {permissions.canManageMembers && (
                                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                                    Actions
                                </th>
                            )}
                        </tr>
                    </thead>
                    <tbody>
                        {members.map((member) => {
                            const isCurrentUser = currentUser && member.uid === currentUser.uid;
                            const canRemove = permissions.canManageMembers &&
                                member.role !== 'owner' &&
                                !isCurrentUser;

                            return (
                                <tr
                                    key={member.uid}
                                    className={`border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors
                                              ${isCurrentUser ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                                >
                                    <td className="py-3 px-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-600 flex items-center justify-center text-white font-bold">
                                                {(member.displayName || member.email || 'U').charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                                                    {member.displayName || 'Unknown User'}
                                                    {isCurrentUser && (
                                                        <span className="text-xs text-blue-600 dark:text-blue-400 font-semibold">
                                                            (You)
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-sm text-gray-500 dark:text-gray-400">
                                                    {member.email || 'No email'}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-3 px-4">
                                        <RoleBadge role={member.role} />
                                    </td>
                                    <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                                        {new Date(member.joinedAt).toLocaleDateString()}
                                    </td>
                                    {permissions.canManageMembers && (
                                        <td className="py-3 px-4 text-right">
                                            {canRemove && (
                                                <button
                                                    onClick={() => handleRemoveMember(member.uid, member.displayName || 'this member')}
                                                    disabled={isLoading}
                                                    className="px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20
                                                             rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    Remove
                                                </button>
                                            )}
                                        </td>
                                    )}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Member Count */}
            <div className="text-sm text-gray-500 dark:text-gray-400">
                Total members: {members.length}
            </div>
        </div>
    );

    const renderRolesTab = () => (
        <div className="space-y-6">
            {/* Role Management Table */}
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                                Member
                            </th>
                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                                Current Role
                            </th>
                            {permissions.canChangeRoles && (
                                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                                    Change Role
                                </th>
                            )}
                        </tr>
                    </thead>
                    <tbody>
                        {members.map((member) => {
                            const isCurrentUser = currentUser && member.uid === currentUser.uid;

                            return (
                                <tr
                                    key={member.uid}
                                    className={`border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors
                                              ${isCurrentUser ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                                >
                                    <td className="py-3 px-4">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium text-gray-900 dark:text-white">
                                                {member.displayName || 'Unknown User'}
                                            </span>
                                            {isCurrentUser && (
                                                <span className="text-xs text-blue-600 dark:text-blue-400 font-semibold">
                                                    (You)
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="py-3 px-4">
                                        <RoleBadge role={member.role} />
                                    </td>
                                    {permissions.canChangeRoles && (
                                        <td className="py-3 px-4">
                                            <MemberRoleDropdown
                                                currentUserRole={currentUserRole}
                                                targetMemberRole={member.role}
                                                targetMemberId={member.uid}
                                                targetMemberName={member.displayName || 'Unknown'}
                                                onRoleChange={(newRole) => handleRoleChange(member.uid, newRole)}
                                                disabled={isLoading}
                                            />
                                        </td>
                                    )}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Role Permissions Info */}
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                <h4 className="font-semibold text-blue-900 dark:text-blue-300 mb-2 flex items-center gap-2">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    Role Permissions
                </h4>
                <div className="space-y-2 text-sm text-blue-800 dark:text-blue-300">
                    <div><strong>Owner:</strong> Full control, can delete workspace and manage all roles</div>
                    <div><strong>Admin:</strong> Can manage members, change roles (except owner), edit all events</div>
                    <div><strong>Member:</strong> Can create and edit own events</div>
                    <div><strong>Viewer:</strong> Can only view events, no editing permissions</div>
                </div>
            </div>
        </div>
    );

    const renderInviteTab = () => (
        <div className="space-y-6">
            {/* Invite Code Display */}
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl p-6 border border-purple-200 dark:border-purple-800">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Workspace Invite Code
                </h3>
                <div className="flex items-center gap-4">
                    <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg p-4 border-2 border-dashed border-purple-300 dark:border-purple-700">
                        <div className="text-center">
                            <div className="text-3xl font-mono font-bold text-purple-600 dark:text-purple-400 tracking-widest">
                                {workspace.inviteCode}
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={copyInviteCode}
                        className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-lg font-medium
                                 hover:from-purple-600 hover:to-pink-700 transition-all duration-200
                                 flex items-center gap-2 shadow-lg hover:shadow-xl"
                    >
                        {copiedCode ? (
                            <>
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                                Copied!
                            </>
                        ) : (
                            <>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                                Copy Code
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Instructions */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-3">How to invite members:</h4>
                <ol className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                    <li className="flex items-start gap-2">
                        <span className="font-bold text-purple-600 dark:text-purple-400">1.</span>
                        <span>Copy the invite code above</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <span className="font-bold text-purple-600 dark:text-purple-400">2.</span>
                        <span>Share it with people you want to invite</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <span className="font-bold text-purple-600 dark:text-purple-400">3.</span>
                        <span>They can join by clicking "Join Workspace" and entering the code</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <span className="font-bold text-purple-600 dark:text-purple-400">4.</span>
                        <span>New members will join as "Member" by default</span>
                    </li>
                </ol>
            </div>

            {/* Security Note */}
            <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 border border-yellow-200 dark:border-yellow-800">
                <div className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <div className="text-sm text-yellow-800 dark:text-yellow-300">
                        <strong>Security tip:</strong> Only share this code with people you trust. Anyone with this code can join your workspace.
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="bg-gradient-to-r from-purple-500 to-pink-600 px-6 py-4 flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold text-white">Workspace Settings</h2>
                        <p className="text-purple-100 text-sm mt-1">{workspace.name}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Tabs */}
                <div className="border-b border-gray-200 dark:border-gray-700 px-6">
                    <div className="flex gap-4">
                        <button
                            onClick={() => setActiveTab('members')}
                            className={`py-3 px-4 font-medium text-sm border-b-2 transition-colors
                                      ${activeTab === 'members'
                                    ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                                }`}
                        >
                            Members
                        </button>
                        <button
                            onClick={() => setActiveTab('roles')}
                            className={`py-3 px-4 font-medium text-sm border-b-2 transition-colors
                                      ${activeTab === 'roles'
                                    ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                                }`}
                        >
                            Roles
                        </button>
                        <button
                            onClick={() => setActiveTab('invite')}
                            className={`py-3 px-4 font-medium text-sm border-b-2 transition-colors
                                      ${activeTab === 'invite'
                                    ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                                }`}
                        >
                            Invite Code
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {error && (
                        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                            <div className="flex items-center gap-2 text-red-800 dark:text-red-300">
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                </svg>
                                {error}
                            </div>
                        </div>
                    )}

                    {activeTab === 'members' && renderMembersTab()}
                    {activeTab === 'roles' && renderRolesTab()}
                    {activeTab === 'invite' && renderInviteTab()}
                </div>
            </div>
        </div>
    );
};

export default WorkspaceSettings;
