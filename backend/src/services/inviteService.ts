/**
 * Email Invite Service
 * Business logic for email-based workspace invitations
 */

import { db } from '../config/firebase';
import { logger } from '../utils/logger';
import { EmailInvite, SendEmailInviteRequest } from '../types/invite';
import { Workspace, WorkspaceMember } from '../types/workspace';
import { WorkspaceRole } from '../types/roles';

const workspacesCollection = db.collection('workspaces');
const invitesCollection = db.collection('invites');

/**
 * Send an email invite to join a workspace
 */
export const sendEmailInvite = async (
    workspaceId: string,
    email: string,
    role: 'admin' | 'member' | 'viewer',
    inviterId: string,
    inviterName: string
): Promise<EmailInvite> => {
    try {
        logger.debug(`Sending email invite to ${email} for workspace ${workspaceId}`);

        // Check if workspace exists
        const workspaceDoc = await workspacesCollection.doc(workspaceId).get();
        if (!workspaceDoc.exists) {
            throw new Error('Workspace not found');
        }

        const workspace = { id: workspaceDoc.id, ...workspaceDoc.data() } as Workspace;

        // Check if user is already a member
        const isAlreadyMember = workspace.members.some(m => m.email === email);
        if (isAlreadyMember) {
            throw new Error('User is already a member of this workspace');
        }

        // Check for existing pending invite
        const existingInvite = await invitesCollection
            .where('workspaceId', '==', workspaceId)
            .where('email', '==', email)
            .where('status', '==', 'pending')
            .limit(1)
            .get();

        if (!existingInvite.empty) {
            throw new Error('An invite has already been sent to this email');
        }

        // Create invite
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // Expires in 7 days

        const invite: Omit<EmailInvite, 'id'> = {
            workspaceId,
            email: email.toLowerCase(),
            role,
            status: 'pending',
            invitedBy: inviterId,
            invitedByName: inviterName,
            createdAt: new Date().toISOString(),
            expiresAt: expiresAt.toISOString()
        };

        const docRef = await invitesCollection.add(invite);

        const createdInvite: EmailInvite = {
            id: docRef.id,
            ...invite
        };

        logger.success(`Email invite sent to ${email} for workspace ${workspaceId}`);

        // TODO: Send actual email notification here
        // This would integrate with a service like SendGrid, AWS SES, etc.

        return createdInvite;
    } catch (error) {
        logger.error('Error sending email invite', error);
        throw error;
    }
};

/**
 * Accept an email invite
 */
export const acceptEmailInvite = async (
    inviteId: string,
    userId: string,
    userEmail: string,
    userName: string
): Promise<Workspace> => {
    try {
        logger.debug(`User ${userId} accepting invite ${inviteId}`);

        return await db.runTransaction(async (transaction) => {
            // Get invite
            const inviteRef = invitesCollection.doc(inviteId);
            const inviteDoc = await transaction.get(inviteRef);

            if (!inviteDoc.exists) {
                throw new Error('Invite not found');
            }

            const invite = { id: inviteDoc.id, ...inviteDoc.data() } as EmailInvite;

            // Validate invite
            if (invite.status !== 'pending') {
                throw new Error('Invite has already been used or expired');
            }

            if (invite.email.toLowerCase() !== userEmail.toLowerCase()) {
                throw new Error('This invite was sent to a different email address');
            }

            if (new Date(invite.expiresAt) < new Date()) {
                // Mark as expired
                transaction.update(inviteRef, { status: 'expired' });
                throw new Error('This invite has expired');
            }

            // Get workspace
            const workspaceRef = workspacesCollection.doc(invite.workspaceId);
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

            // Add user to workspace
            const newMember: WorkspaceMember = {
                uid: userId,
                role: invite.role,
                joinedAt: new Date().toISOString(),
                displayName: userName,
                email: userEmail
            };

            const updatedMembers = [...workspace.members, newMember];

            transaction.update(workspaceRef, {
                members: updatedMembers,
                updatedAt: new Date().toISOString()
            });

            // Update invite status
            transaction.update(inviteRef, {
                status: 'accepted',
                acceptedAt: new Date().toISOString()
            });

            logger.success(`User ${userId} accepted invite and joined workspace ${invite.workspaceId}`);

            return {
                ...workspace,
                members: updatedMembers,
                updatedAt: new Date().toISOString()
            };
        });
    } catch (error) {
        logger.error('Error accepting email invite', error);
        throw error;
    }
};

/**
 * Get all invites for a workspace
 */
export const getWorkspaceInvites = async (
    workspaceId: string,
    requesterId: string
): Promise<EmailInvite[]> => {
    try {
        logger.debug(`Fetching invites for workspace ${workspaceId}`);

        // Verify requester is a member
        const workspaceDoc = await workspacesCollection.doc(workspaceId).get();
        if (!workspaceDoc.exists) {
            throw new Error('Workspace not found');
        }

        const workspace = { id: workspaceDoc.id, ...workspaceDoc.data() } as Workspace;
        const requesterMember = workspace.members.find(m => m.uid === requesterId);

        if (!requesterMember) {
            throw new Error('Access denied: Not a member of this workspace');
        }

        // Only owner and admin can view invites
        if (requesterMember.role !== 'owner' && requesterMember.role !== 'admin') {
            throw new Error('Access denied: Only owners and admins can view invites');
        }

        // Get all invites for this workspace
        const snapshot = await invitesCollection
            .where('workspaceId', '==', workspaceId)
            .orderBy('createdAt', 'desc')
            .get();

        const invites = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as EmailInvite[];

        logger.success(`Retrieved ${invites.length} invites for workspace ${workspaceId}`);
        return invites;
    } catch (error) {
        logger.error('Error fetching workspace invites', error);
        throw error;
    }
};

/**
 * Get pending invites for a user by email
 */
export const getUserPendingInvites = async (userEmail: string): Promise<EmailInvite[]> => {
    try {
        logger.debug(`Fetching pending invites for ${userEmail}`);

        const snapshot = await invitesCollection
            .where('email', '==', userEmail.toLowerCase())
            .where('status', '==', 'pending')
            .get();

        const invites = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as EmailInvite))
            .filter(invite => new Date(invite.expiresAt) > new Date()); // Filter out expired

        logger.success(`Found ${invites.length} pending invites for ${userEmail}`);
        return invites;
    } catch (error) {
        logger.error('Error fetching user pending invites', error);
        throw error;
    }
};

/**
 * Cancel/revoke an invite
 */
export const cancelInvite = async (
    inviteId: string,
    requesterId: string
): Promise<void> => {
    try {
        logger.debug(`Canceling invite ${inviteId}`);

        const inviteDoc = await invitesCollection.doc(inviteId).get();
        if (!inviteDoc.exists) {
            throw new Error('Invite not found');
        }

        const invite = { id: inviteDoc.id, ...inviteDoc.data() } as EmailInvite;

        // Verify requester has permission
        const workspaceDoc = await workspacesCollection.doc(invite.workspaceId).get();
        if (!workspaceDoc.exists) {
            throw new Error('Workspace not found');
        }

        const workspace = { id: workspaceDoc.id, ...workspaceDoc.data() } as Workspace;
        const requesterMember = workspace.members.find(m => m.uid === requesterId);

        if (!requesterMember || (requesterMember.role !== 'owner' && requesterMember.role !== 'admin')) {
            throw new Error('Access denied: Only owners and admins can cancel invites');
        }

        // Delete the invite
        await invitesCollection.doc(inviteId).delete();

        logger.success(`Invite ${inviteId} canceled successfully`);
    } catch (error) {
        logger.error('Error canceling invite', error);
        throw error;
    }
};
