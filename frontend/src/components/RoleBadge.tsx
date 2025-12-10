/**
 * Role Badge Component
 * Displays role badges with appropriate styling for each role type
 */

import React from 'react';
import type { WorkspaceRole } from '../types/roles';

interface RoleBadgeProps {
    role: WorkspaceRole;
    className?: string;
}

const RoleBadge: React.FC<RoleBadgeProps> = ({ role, className = '' }) => {
    const getRoleConfig = (role: WorkspaceRole) => {
        switch (role) {
            case 'owner':
                return {
                    label: 'OWNER',
                    bgColor: 'bg-gradient-to-r from-purple-500 to-pink-600',
                    textColor: 'text-white',
                    icon: (
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z" clipRule="evenodd" />
                        </svg>
                    )
                };
            case 'admin':
                return {
                    label: 'ADMIN',
                    bgColor: 'bg-gradient-to-r from-blue-500 to-cyan-600',
                    textColor: 'text-white',
                    icon: (
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 8a6 6 0 01-7.743 5.743L10 14l-1 1-1 1H6v2H2v-4l4.257-4.257A6 6 0 1118 8zm-6-4a1 1 0 100 2 2 2 0 012 2 1 1 0 102 0 4 4 0 00-4-4z" clipRule="evenodd" />
                        </svg>
                    )
                };
            case 'member':
                return {
                    label: 'MEMBER',
                    bgColor: 'bg-gradient-to-r from-green-500 to-emerald-600',
                    textColor: 'text-white',
                    icon: (
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" />
                        </svg>
                    )
                };
            case 'viewer':
                return {
                    label: 'VIEWER',
                    bgColor: 'bg-gradient-to-r from-gray-500 to-slate-600',
                    textColor: 'text-white',
                    icon: (
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                            <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                        </svg>
                    )
                };
        }
    };

    const config = getRoleConfig(role);

    return (
        <span
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold
                       ${config.bgColor} ${config.textColor} shadow-sm ${className}`}
        >
            {config.icon}
            {config.label}
        </span>
    );
};

export default RoleBadge;
