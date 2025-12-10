/**
 * Member Role Dropdown Component
 * Dropdown selector for changing member roles with permission validation
 */

import React, { useState } from 'react';
import type { WorkspaceRole } from '../types/roles';
import { canModifyRole } from '../types/roles';
import { logger } from '../utils/logger';

interface MemberRoleDropdownProps {
    currentUserRole: WorkspaceRole;
    targetMemberRole: WorkspaceRole;
    targetMemberId: string;
    targetMemberName: string;
    onRoleChange: (newRole: WorkspaceRole) => Promise<void>;
    disabled?: boolean;
}

const MemberRoleDropdown: React.FC<MemberRoleDropdownProps> = ({
    currentUserRole,
    targetMemberRole,
    targetMemberId,
    targetMemberName,
    onRoleChange,
    disabled = false
}) => {
    const [isChanging, setIsChanging] = useState(false);
    const [selectedRole, setSelectedRole] = useState<WorkspaceRole>(targetMemberRole);

    const roles: WorkspaceRole[] = ['owner', 'admin', 'member', 'viewer'];

    const handleRoleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newRole = e.target.value as WorkspaceRole;

        // Check if user can modify this role
        if (!canModifyRole(currentUserRole, targetMemberRole, newRole)) {
            logger.warn('Insufficient permissions to change role');
            return;
        }

        setIsChanging(true);
        setSelectedRole(newRole);

        try {
            logger.userAction('Changing member role', {
                targetMemberId,
                targetMemberName,
                from: targetMemberRole,
                to: newRole
            });

            await onRoleChange(newRole);
            logger.success('Role changed successfully');
        } catch (error) {
            logger.error('Failed to change role', error);
            // Revert selection on error
            setSelectedRole(targetMemberRole);
        } finally {
            setIsChanging(false);
        }
    };

    // Check if dropdown should be disabled
    const isDisabled = disabled || isChanging;

    // Filter available roles based on permissions
    const availableRoles = roles.filter(role => {
        // Owner role is never selectable
        if (role === 'owner') return false;

        // Check if current user can set this role
        return canModifyRole(currentUserRole, targetMemberRole, role);
    });

    // If no roles can be changed, don't show dropdown
    if (availableRoles.length === 0 || targetMemberRole === 'owner') {
        return (
            <span className="text-sm text-gray-500 dark:text-gray-400 italic">
                Cannot modify
            </span>
        );
    }

    return (
        <div className="relative">
            <select
                value={selectedRole}
                onChange={handleRoleChange}
                disabled={isDisabled}
                className="appearance-none px-3 py-1.5 pr-8 rounded-lg border border-gray-300 dark:border-gray-600
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm
                         focus:ring-2 focus:ring-blue-500 focus:border-transparent
                         disabled:opacity-50 disabled:cursor-not-allowed
                         transition-all duration-200 cursor-pointer"
            >
                {/* Current role always shown */}
                <option value={targetMemberRole}>
                    {targetMemberRole.charAt(0).toUpperCase() + targetMemberRole.slice(1)}
                </option>

                {/* Other available roles */}
                {availableRoles
                    .filter(role => role !== targetMemberRole)
                    .map(role => (
                        <option key={role} value={role}>
                            {role.charAt(0).toUpperCase() + role.slice(1)}
                        </option>
                    ))}
            </select>

            {/* Dropdown icon */}
            <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                {isChanging ? (
                    <svg className="animate-spin h-4 w-4 text-gray-400" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                ) : (
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                )}
            </div>
        </div>
    );
};

export default MemberRoleDropdown;
