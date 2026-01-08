import { TeamInvitation, User, Team, TeamMember, TeamRole, Notification } from '@/models/index';
import RuntimeError from '@/utilities/runtime/runtime-error';
import { ErrorCodes } from '@/constants/error-codes';
import { publishNotificationCreated } from '@/events/notification-events';
import crypto from 'crypto';

export class TeamInvitationService {
    /**
     * Send a team invitation to a user.
     */
    async sendInvitation(team: any, invitedByUserId: string, email: string, role: string) {
        const user = await User.findOne({ email: email.toLowerCase() });

        if (user && team.members.includes(user._id)) {
            throw new RuntimeError(ErrorCodes.TEAM_INVITATION_USER_ALREADY_MEMBER, 400);
        }

        const existingInvitation = await TeamInvitation.findOne({
            team: team._id,
            email: email.toLowerCase(),
            status: 'pending'
        });

        if (existingInvitation) {
            throw new RuntimeError(ErrorCodes.TEAM_INVITATION_ALREADY_SENT, 400);
        }

        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

        const invitation = await TeamInvitation.create({
            team: team._id,
            invitedBy: invitedByUserId,
            invitedUser: user?._id,
            email: email.toLowerCase(),
            role,
            token,
            expiresAt
        });

        if (user) {
            const notification = await Notification.create({
                recipient: user._id,
                title: 'Team Invitation',
                content: `You have been invited to join the team "${team.name}" as ${role.toLowerCase()}`,
                link: `/team-invitation/${invitation.token}`
            });

            await publishNotificationCreated(user._id.toString(), notification);
        }

        return invitation;
    }

    /**
     * Cancel a pending invitation.
     */
    async cancelInvitation(teamId: string, invitationId: string) {
        const invitation = await TeamInvitation.findOne({
            _id: invitationId,
            team: teamId,
            status: 'pending'
        });

        if (!invitation) {
            throw new RuntimeError(ErrorCodes.TEAM_INVITATION_NOT_FOUND, 404);
        }

        invitation.status = 'rejected';
        await invitation.save();
        return invitation;
    }

    /**
     * Get all pending invitations for a team.
     */
    async getPendingInvitations(teamId: string) {
        return await TeamInvitation.find({
            team: teamId,
            status: 'pending'
        })
            .populate('team', 'name description')
            .populate('invitedBy', 'email')
            .sort({ createdAt: -1 });
    }

    /**
     * Accept an invitation.
     */
    async acceptInvitation(invitation: any, userId: string, userEmail: string) {
        const team = await Team.findByIdAndUpdate(
            invitation.team,
            { $addToSet: { members: userId } },
            { new: true }
        );

        if (!team) {
            throw new RuntimeError(ErrorCodes.TEAM_NOT_FOUND, 404);
        }

        await User.findByIdAndUpdate(
            userId,
            { $addToSet: { teams: invitation.team } }
        );

        let roleToAssign = null;
        if (invitation.role) {
            roleToAssign = await TeamRole.findOne({
                team: invitation.team,
                name: invitation.role
            });
        }

        if (!roleToAssign) {
            roleToAssign = await TeamRole.findOne({
                team: invitation.team,
                name: 'Member',
                isSystem: true
            });
        }

        if (roleToAssign) {
            const existingMember = await TeamMember.findOne({
                team: invitation.team,
                user: userId
            });

            if (!existingMember) {
                await TeamMember.create({
                    team: invitation.team,
                    user: userId,
                    role: roleToAssign._id,
                    joinedAt: new Date()
                });
            }
        }

        invitation.status = 'accepted';
        invitation.acceptedAt = new Date();
        await invitation.save();

        await Notification.create({
            recipient: team.owner,
            title: 'Team Invitation Accepted',
            content: `${userEmail} has accepted the invitation to join ${team.name}`,
            link: `/dashboard?team=${team._id}`
        });

        return team;
    }

    /**
     * Reject an invitation.
     */
    async rejectInvitation(invitation: any) {
        invitation.status = 'rejected';
        await invitation.save();
        return invitation;
    }

    /**
     * Get details of an invitation.
     */
    async getInvitationDetails(invitation: any) {
        const team = await Team.findById(invitation.team)
            .select('name description members')
            .lean();

        if (!team) {
            throw new RuntimeError(ErrorCodes.TEAM_NOT_FOUND, 404);
        }

        const invitedBy = await User.findById(invitation.invitedBy).select('email').lean();

        return {
            ...invitation.toObject(),
            invitedBy,
            team: {
                _id: team._id,
                name: team.name,
                description: team.description,
                memberCount: team.members?.length || 0
            }
        };
    }
}

export default new TeamInvitationService();
