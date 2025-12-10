/**
 * Frontend Role Type Definitions
 * TypeScript interfaces for role-based access control
 */

export type WorkspaceRole = 'owner' | 'admin' | 'member' | 'viewer';

export interface RolePermissions {
    canEditWorkspace: boolean;
    canDeleteWorkspace: boolean;
    canManageMembers: boolean;
    canChangeRoles: boolean;
    canEditAllEvents: boolean;
    canEditOwnEvents: boolean;
    canCreateEvents: boolean;
    canViewEvents: boolean;
}

export interface MemberInfo {
    uid: string;
    displayName: string;
    email: string;
    role: WorkspaceRole;
    joinedAt: string;
}

/**
 * Get permissions for a given role
 */
export const getRolePermissions = (role: WorkspaceRole): RolePermissions => {
    switch (role) {
        case 'owner':
            return {
                canEditWorkspace: true,
                canDeleteWorkspace: true,
                canManageMembers: true,
                canChangeRoles: true,
                canEditAllEvents: true,
                canEditOwnEvents: true,
                canCreateEvents: true,
                canViewEvents: true
            };
        case 'admin':
            return {
                canEditWorkspace: false,
                canDeleteWorkspace: false,
                canManageMembers: true,
                canChangeRoles: true,
                canEditAllEvents: true,
                canEditOwnEvents: true,
                canCreateEvents: true,
                canViewEvents: true
            };
        case 'member':
            return {
                canEditWorkspace: false,
                canDeleteWorkspace: false,
                canManageMembers: false,
                canChangeRoles: false,
                canEditAllEvents: false,
                canEditOwnEvents: true,
                canCreateEvents: true,
                canViewEvents: true
            };
        case 'viewer':
            return {
                canEditWorkspace: false,
                canDeleteWorkspace: false,
                canManageMembers: false,
                canChangeRoles: false,
                canEditAllEvents: false,
                canEditOwnEvents: false,
                canCreateEvents: false,
                canViewEvents: true
            };
    }
};

/**
 * Check if current user can modify target user's role
 */
export const canModifyRole = (
    currentUserRole: WorkspaceRole,
    targetRole: WorkspaceRole,
    newRole: WorkspaceRole
): boolean => {
    // Owner can modify anyone except themselves to non-owner
    if (currentUserRole === 'owner') {
        if (targetRole === 'owner') return false;
        if (newRole === 'owner') return false;
        return true;
    }

    // Admin can modify members and viewers, but not other admins or owner
    if (currentUserRole === 'admin') {
        if (targetRole === 'owner' || targetRole === 'admin') return false;
        if (newRole === 'owner' || newRole === 'admin') return false;
        return true;
    }

    return false;
};
