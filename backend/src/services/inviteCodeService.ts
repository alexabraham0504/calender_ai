/**
 * Invite Code Service
 * Business logic for invite code generation and redemption
 */

import { db } from '../config/firebase';
import { logger } from '../utils/logger';
import { InviteCode } from '../types/invite';
import { Workspace, WorkspaceMember } from '../types/workspace';
import crypto from 'crypto';

const workspacesCollection = db.collection('workspaces');
const inviteCodesCollection = db.collection('inviteCodes');

/**
 * Generate a random invite code
 */
const generateCode = (): string => {
    return crypto.randomBytes(4).toString('hex').toUpperCase();
};

/**
 * Generate a new invite code for a workspace
 */
export const generateInviteCode = async (
    workspaceId: string,
    creatorId: string,
    validUntil?: string,
    maxUses: number = 100
): Promise<InviteCode> => {
    try {
        logger.debug(`Generating invite code for workspace ${workspaceId}`);

        // Verify workspace exists
        const workspaceDoc = await workspacesCollection.doc(workspaceId).get();
        if (!workspaceDoc.exists) {
            throw new Error('Workspace not found');
        }

        const workspace = { id: workspaceDoc.id, ...workspaceDoc.data() } as Workspace;

        // Verify creator has permission
        const creatorMember = workspace.members.find(m => m.uid === creatorId);
        if (!creatorMember || (creatorMember.role !== 'owner' && creatorMember.role !== 'admin')) {
            throw new Error('Access denied: Only owners and admins can generate invite codes');
        }

        // Deactivate existing active codes for this workspace
        const existingCodes = await inviteCodesCollection
            .where('workspaceId', '==', workspaceId)
            .where('isActive', '==', true)
            .get();

        const batch = db.batch();
        existingCodes.docs.forEach(doc => {
            batch.update(doc.ref, { isActive: false });
        });
        await batch.commit();

        // Set default expiration (30 days)
        const defaultExpiration = new Date();
        defaultExpiration.setDate(defaultExpiration.getDate() + 30);

        // Generate unique code
        let code = generateCode();
        let isUnique = false;
        let attempts = 0;

        while (!isUnique && attempts < 10) {
            const existing = await inviteCodesCollection
                .where('code', '==', code)
                .where('isActive', '==', true)
                .limit(1)
                .get();

            if (existing.empty) {
                isUnique = true;
            } else {
                code = generateCode();
                attempts++;
            }
        }

        if (!isUnique) {
            throw new Error('Failed to generate unique invite code');
        }

        // Create invite code
        const inviteCode: Omit<InviteCode, 'id'> = {
            workspaceId,
            code,
            validUntil: validUntil || defaultExpiration.toISOString(),
            maxUses,
            usedCount: 0,
            createdBy: creatorId,
            createdAt: new Date().toISOString(),
            isActive: true
        };

        const docRef = await inviteCodesCollection.add(inviteCode);

        const createdCode: InviteCode = {
            id: docRef.id,
            ...inviteCode
        };

        logger.success(`Invite code ${code} generated for workspace ${workspaceId}`);
        return createdCode;
    } catch (error) {
        logger.error('Error generating invite code', error);
        throw error;
    }
};

/**
 * Accept/redeem an invite code
 */
export const acceptInviteCode = async (
    code: string,
    userId: string,
    userEmail: string,
    userName: string
): Promise<Workspace> => {
    try {
        logger.debug(`User ${userId} attempting to redeem invite code ${code}`);

        return await db.runTransaction(async (transaction) => {
            // Find invite code
            const codesSnapshot = await inviteCodesCollection
                .where('code', '==', code.toUpperCase())
                .where('isActive', '==', true)
                .limit(1)
                .get();

            if (codesSnapshot.empty) {
                throw new Error('Invalid or inactive invite code');
            }

            const codeDoc = codesSnapshot.docs[0];
            const inviteCode = { id: codeDoc.id, ...codeDoc.data() } as InviteCode;

            // Validate invite code
            if (new Date(inviteCode.validUntil) < new Date()) {
                transaction.update(codeDoc.ref, { isActive: false });
                throw new Error('This invite code has expired');
            }

            if (inviteCode.usedCount >= inviteCode.maxUses) {
                transaction.update(codeDoc.ref, { isActive: false });
                throw new Error('This invite code has reached its maximum uses');
            }

            // Get workspace
            const workspaceRef = workspacesCollection.doc(inviteCode.workspaceId);
            const workspaceDoc = await transaction.get(workspaceRef);

            if (!workspaceDoc.exists) {
                throw new Error('Workspace not found');
            }

            const workspace = { id: workspaceDoc.id, ...workspaceDoc.data() } as Workspace;

            // Check if already a member
            const isAlreadyMember = workspace.members.some(m => m.uid === userId);
            if (isAlreadyMember) {
                throw new Error('You are already a member of this workspace');
            }

            // Add user to workspace as member (default role)
            const newMember: WorkspaceMember = {
                uid: userId,
                role: 'member',
                joinedAt: new Date().toISOString(),
                displayName: userName,
                email: userEmail
            };

            const updatedMembers = [...workspace.members, newMember];

            transaction.update(workspaceRef, {
                members: updatedMembers,
                updatedAt: new Date().toISOString()
            });

            // Increment usage count
            transaction.update(codeDoc.ref, {
                usedCount: inviteCode.usedCount + 1
            });

            logger.success(`User ${userId} joined workspace ${inviteCode.workspaceId} via invite code`);

            return {
                ...workspace,
                members: updatedMembers,
                updatedAt: new Date().toISOString()
            };
        });
    } catch (error) {
        logger.error('Error accepting invite code', error);
        throw error;
    }
};

/**
 * Get active invite code for a workspace
 */
export const getActiveInviteCode = async (
    workspaceId: string,
    requesterId: string
): Promise<InviteCode | null> => {
    try {
        logger.debug(`Fetching active invite code for workspace ${workspaceId}`);

        // Verify requester has permission
        const workspaceDoc = await workspacesCollection.doc(workspaceId).get();
        if (!workspaceDoc.exists) {
            throw new Error('Workspace not found');
        }

        const workspace = { id: workspaceDoc.id, ...workspaceDoc.data() } as Workspace;
        const requesterMember = workspace.members.find(m => m.uid === requesterId);

        if (!requesterMember) {
            throw new Error('Access denied: Not a member of this workspace');
        }

        // Get active invite code
        const snapshot = await inviteCodesCollection
            .where('workspaceId', '==', workspaceId)
            .where('isActive', '==', true)
            .limit(1)
            .get();

        if (snapshot.empty) {
            return null;
        }

        const inviteCode = {
            id: snapshot.docs[0].id,
            ...snapshot.docs[0].data()
        } as InviteCode;

        // Check if expired
        if (new Date(inviteCode.validUntil) < new Date()) {
            await inviteCodesCollection.doc(inviteCode.id!).update({ isActive: false });
            return null;
        }

        logger.success(`Retrieved active invite code for workspace ${workspaceId}`);
        return inviteCode;
    } catch (error) {
        logger.error('Error fetching active invite code', error);
        throw error;
    }
};

/**
 * Deactivate an invite code
 */
export const deactivateInviteCode = async (
    codeId: string,
    requesterId: string
): Promise<void> => {
    try {
        logger.debug(`Deactivating invite code ${codeId}`);

        const codeDoc = await inviteCodesCollection.doc(codeId).get();
        if (!codeDoc.exists) {
            throw new Error('Invite code not found');
        }

        const inviteCode = { id: codeDoc.id, ...codeDoc.data() } as InviteCode;

        // Verify requester has permission
        const workspaceDoc = await workspacesCollection.doc(inviteCode.workspaceId).get();
        if (!workspaceDoc.exists) {
            throw new Error('Workspace not found');
        }

        const workspace = { id: workspaceDoc.id, ...workspaceDoc.data() } as Workspace;
        const requesterMember = workspace.members.find(m => m.uid === requesterId);

        if (!requesterMember || (requesterMember.role !== 'owner' && requesterMember.role !== 'admin')) {
            throw new Error('Access denied: Only owners and admins can deactivate invite codes');
        }

        // Deactivate the code
        await inviteCodesCollection.doc(codeId).update({ isActive: false });

        logger.success(`Invite code ${codeId} deactivated successfully`);
    } catch (error) {
        logger.error('Error deactivating invite code', error);
        throw error;
    }
};
