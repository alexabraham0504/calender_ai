/**
 * Workspace Utility Functions
 * Helper functions for workspace operations including slug generation and invite code creation
 */

import crypto from 'crypto';

/**
 * Generate a URL-friendly slug from workspace name
 * @param name - Workspace name
 * @returns URL-safe slug
 */
export const generateWorkspaceSlug = (name: string): string => {
    return name
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '') // Remove special characters
        .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
        .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
};

/**
 * Generate a unique invite code for workspace
 * @returns 8-character alphanumeric invite code
 */
export const generateInviteCode = (): string => {
    return crypto.randomBytes(4).toString('hex').toUpperCase();
};

/**
 * Validate workspace name
 * @param name - Workspace name to validate
 * @returns Validation result with error message if invalid
 */
export const validateWorkspaceName = (name: string): { valid: boolean; error?: string } => {
    if (!name || name.trim().length === 0) {
        return { valid: false, error: 'Workspace name is required' };
    }

    if (name.length < 3) {
        return { valid: false, error: 'Workspace name must be at least 3 characters' };
    }

    if (name.length > 50) {
        return { valid: false, error: 'Workspace name must be less than 50 characters' };
    }

    return { valid: true };
};

/**
 * Validate invite code format
 * @param code - Invite code to validate
 * @returns Validation result
 */
export const validateInviteCode = (code: string): { valid: boolean; error?: string } => {
    if (!code || code.trim().length === 0) {
        return { valid: false, error: 'Invite code is required' };
    }

    if (!/^[A-F0-9]{8}$/i.test(code)) {
        return { valid: false, error: 'Invalid invite code format' };
    }

    return { valid: true };
};
