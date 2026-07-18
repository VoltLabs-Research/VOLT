import eventBus from '@shared/infrastructure/events/RedisEventBus';
import { ErrorCodes } from '@core/constants/error-codes';
import { SystemRoleNames } from '@core/constants/system-roles';
import UserModel from '@modules/auth/models/UserModel';
import TeamModel from '@modules/team/models/team/TeamModel';
import TeamMemberModel from '@modules/team/models/team-member/TeamMemberModel';
import TeamRoleModel from '@modules/team/models/team-role/TeamRoleModel';
import TeamInvitationModel, {
    TeamInvitationStatus,
    isTeamInvitationExpired,
    isTeamInvitationPending,
    normalizeInvitationEmail
} from '@modules/team/models/team-invitation/TeamInvitationModel';
import type { TeamInvitationProps } from '@modules/team/models/team-invitation/TeamInvitationModel';
import { toPersistedOutput } from '@modules/team/utilities/toPersistedOutput';
import InvitationSentEvent from '@modules/team/events/team-invitation/InvitationSentEvent';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IEventBus } from '@shared/application/events/IEventBus';
import type { PaginatedResult } from '@shared/domain/port/IBaseRepository';
import type { PersistedOutput } from '@shared/domain/port/PersistedEntity';
import crypto from 'crypto';
import type { SendTeamInvitationInput, UpdateTeamInvitationInput } from '@volt/contracts/modules/team/http';

const INVITATION_RELATIONS = ['team', 'invitedBy', 'invitedUser', 'role'];

export default class TeamInvitationService {
    #users = {
        findByEmail: (email: string) => UserModel.findOne({ email: email.toLowerCase() }),
        addTeamToUser: (userId: string, teamId: string) => UserModel.findByIdAndUpdate(userId, { $addToSet: { teams: teamId } })
    };
    #eventBus = eventBus;

    async send(teamId: string, userId: string, input: SendTeamInvitationInput): Promise<PersistedOutput<TeamInvitationProps>> {
        const normalizedEmail = normalizeInvitationEmail(input.email);

        const team = await TeamModel.findById(teamId);
        if (!team) {
            throw ApplicationError.notFound(ErrorCodes.TEAM_NOT_FOUND, 'Team not found');
        }

        const user = await this.#users.findByEmail(normalizedEmail);
        if (!user) {
            throw ApplicationError.notFound(ErrorCodes.USER_NOT_FOUND, 'User not found');
        }

        const isMember = await TeamMemberModel.findOne({ team: teamId, user: user.id });
        if (isMember) {
            throw ApplicationError.badRequest(ErrorCodes.TEAM_INVITATION_USER_ALREADY_MEMBER, 'User is already a member of this team');
        }

        const existingInvitation = await TeamInvitationModel.findOne({
            team: teamId,
            email: normalizedEmail,
            status: TeamInvitationStatus.Pending
        });
        if (existingInvitation) {
            throw ApplicationError.badRequest(ErrorCodes.TEAM_INVITATION_ALREADY_SENT, 'Invitation already sent to this email');
        }

        const role = input.roleId
            ? await TeamRoleModel.findById(input.roleId)
            : await TeamRoleModel.findOne({ name: 'Member', team: teamId });
        if (!role) {
            throw ApplicationError.notFound(ErrorCodes.TEAM_ROLE_NOT_FOUND, 'Team role not found');
        }

        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

        const invitation = await TeamInvitationModel.create({
            team: teamId,
            invitedBy: userId,
            invitedUser: user.id,
            email: normalizedEmail,
            token,
            role: role._id,
            expiresAt,
            status: TeamInvitationStatus.Pending
        });

        await this.#eventBus.publish(new InvitationSentEvent({
            invitationId: String(invitation._id),
            teamName: team.name,
            invitedUserId: String(invitation.invitedUser)
        }));

        return toPersistedOutput(invitation, INVITATION_RELATIONS);
    }

    async listByTeamId(teamId: string, page = 1, limit = 10): Promise<PaginatedResult<PersistedOutput<TeamInvitationProps>>> {
        const filter = { team: teamId, status: TeamInvitationStatus.Pending };
        const skip = (page - 1) * limit;

        const [docs, total] = await Promise.all([
            TeamInvitationModel.find(filter).populate('invitedUser').skip(skip).limit(limit),
            TeamInvitationModel.countDocuments(filter)
        ]);

        return {
            data: docs.map((doc) => toPersistedOutput<TeamInvitationProps>(doc, INVITATION_RELATIONS)),
            total,
            page,
            totalPages: Math.ceil(total / limit),
            limit
        };
    }

    async deleteById(invitationId: string): Promise<void> {
        const deleted = await TeamInvitationModel.findByIdAndDelete(invitationId);
        if (!deleted) {
            throw ApplicationError.notFound(ErrorCodes.TEAM_INVITATION_NOT_FOUND, 'TeamInvitation not found');
        }
    }

    async updateById(invitationId: string, data: UpdateTeamInvitationInput): Promise<PersistedOutput<TeamInvitationProps>> {
        const updated = await TeamInvitationModel.findByIdAndUpdate(invitationId, { $set: data }, { new: true });
        if (!updated) {
            throw ApplicationError.notFound(ErrorCodes.TEAM_INVITATION_NOT_FOUND, 'TeamInvitation not found');
        }
        return toPersistedOutput(updated, INVITATION_RELATIONS);
    }

    async getByIdPublic(invitationId: string): Promise<PersistedOutput<TeamInvitationProps>> {
        const invitation = await TeamInvitationModel.findById(invitationId)
            .populate({ path: 'invitedBy team', select: ['firstName', 'lastName', 'name', '_id'] });
        if (!invitation) {
            throw ApplicationError.notFound(ErrorCodes.TEAM_INVITATION_NOT_FOUND, 'TeamInvitation not found');
        }
        return toPersistedOutput(invitation, INVITATION_RELATIONS);
    }

    async accept(invitationId: string, userId: string): Promise<{ message: string }> {
        const invitation = await TeamInvitationModel.findById(invitationId);
        if (!invitation) {
            throw ApplicationError.notFound(ErrorCodes.TEAM_INVITATION_NOT_FOUND, 'Invitation not found');
        }
        if (!isTeamInvitationPending(invitation)) {
            throw ApplicationError.badRequest(ErrorCodes.TEAM_INVITATION_ALREADY_PROCESSED, 'Invitation has already been processed');
        }
        if (isTeamInvitationExpired(invitation)) {
            throw ApplicationError.badRequest(ErrorCodes.TEAM_INVITATION_EXPIRED, 'Invitation has expired');
        }
        if (String(invitation.invitedUser) !== userId) {
            throw ApplicationError.forbidden(ErrorCodes.TEAM_INVITATION_INVALID_USER, 'This invitation was not sent to you');
        }

        const teamId = String(invitation.team);
        const ownerRole = await TeamRoleModel.findOne({ name: SystemRoleNames.OWNER, team: teamId });
        if (!ownerRole) {
            throw ApplicationError.notFound(ErrorCodes.TEAM_ROLE_NOT_FOUND, 'Owner role not found');
        }

        await TeamMemberModel.create({ team: teamId, user: userId, role: ownerRole._id, joinedAt: new Date() });
        await this.#users.addTeamToUser(userId, teamId);
        await TeamInvitationModel.findByIdAndUpdate(invitation._id, {
            status: TeamInvitationStatus.Accepted,
            acceptedAt: new Date()
        });

        return { message: 'Invitation accepted successfully' };
    }

    async reject(invitationId: string, userId: string): Promise<{ message: string }> {
        const invitation = await TeamInvitationModel.findById(invitationId);
        if (!invitation) {
            throw ApplicationError.notFound(ErrorCodes.TEAM_INVITATION_NOT_FOUND, 'Invitation not found');
        }
        if (!isTeamInvitationPending(invitation)) {
            throw ApplicationError.badRequest(ErrorCodes.TEAM_INVITATION_ALREADY_PROCESSED, 'Invitation has already been processed');
        }
        if (String(invitation.invitedUser) !== userId) {
            throw ApplicationError.forbidden(ErrorCodes.TEAM_INVITATION_INVALID_USER, 'This invitation was not sent to you');
        }

        await TeamInvitationModel.findByIdAndUpdate(invitation._id, { status: TeamInvitationStatus.Rejected });

        return { message: 'Invitation rejected successfully' };
    }
}
