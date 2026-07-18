import { ErrorCodes } from '@core/constants/error-codes';
import { SystemRoleNames } from '@core/constants/system-roles';
import type { IUserRepository } from '@modules/auth/ports/IUserRepository';
import { TEAM_TOKENS } from '@modules/team/di/TeamTokens';
import type { ITeamInvitationRepository } from '@modules/team/ports/team-invitation/ITeamInvitationRepository';
import type { ITeamRepository } from '@modules/team/ports/team/ITeamRepository';
import type { ITeamMemberRepository } from '@modules/team/ports/team-member/ITeamMemberRepository';
import type { ITeamRoleRepository } from '@modules/team/ports/team-role/ITeamRoleRepository';
import TeamInvitation, { TeamInvitationStatus } from '@modules/team/entities/team-invitation/TeamInvitation';
import type { TeamInvitationProps } from '@modules/team/entities/team-invitation/TeamInvitation';
import InvitationSentEvent from '@modules/team/events/team-invitation/InvitationSentEvent';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IEventBus } from '@shared/application/events/IEventBus';
import type { PaginatedResult } from '@shared/domain/port/IBaseRepository';
import { toPersistedOutput } from '@shared/domain/port/PersistedEntity';
import type { PersistedOutput } from '@shared/domain/port/PersistedEntity';
import { AUTH_CONTRACT_TOKENS } from '@shared/contracts/tokens/AuthTokens';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import crypto from 'crypto';
import { container as diContainer } from 'tsyringe';
import type { SendTeamInvitationInput, UpdateTeamInvitationInput } from '@volt/contracts/modules/team/http';

/**
 * The single application service for the team-invitation resource. Folds the
 * former send/list/delete/update/accept/reject use-cases plus the two inline
 * route handlers (paginated list, public get-by-id). The invitation repository
 * is a shared singleton (the team event handlers consume it too), resolved once
 * from the DI container alongside the team/member/role/user repositories.
 */
export default class TeamInvitationService {
    #invitations = diContainer.resolve<ITeamInvitationRepository>(TEAM_TOKENS.TeamInvitationRepository);
    #teams = diContainer.resolve<ITeamRepository>(TEAM_TOKENS.TeamRepository);
    #members = diContainer.resolve<ITeamMemberRepository>(TEAM_TOKENS.TeamMemberRepository);
    #roles = diContainer.resolve<ITeamRoleRepository>(TEAM_TOKENS.TeamRoleRepository);
    #users = diContainer.resolve<IUserRepository>(AUTH_CONTRACT_TOKENS.UserRepository);
    #eventBus = diContainer.resolve<IEventBus>(SHARED_TOKENS.EventBus);

    async send(teamId: string, userId: string, input: SendTeamInvitationInput): Promise<PersistedOutput<TeamInvitationProps>> {
        const normalizedEmail = TeamInvitation.normalizeEmail(input.email);

        const team = await this.#teams.findById(teamId);
        if (!team) {
            throw ApplicationError.notFound(ErrorCodes.TEAM_NOT_FOUND, 'Team not found');
        }

        const user = await this.#users.findByEmail(normalizedEmail);
        if (!user) {
            throw ApplicationError.notFound(ErrorCodes.USER_NOT_FOUND, 'User not found');
        }

        const isMember = await this.#members.findOne({ team: teamId, user: user.id });
        if (isMember) {
            throw ApplicationError.badRequest(ErrorCodes.TEAM_INVITATION_USER_ALREADY_MEMBER, 'User is already a member of this team');
        }

        const existingInvitation = await this.#invitations.findOne({
            team: teamId,
            email: normalizedEmail,
            status: TeamInvitationStatus.Pending
        });
        if (existingInvitation) {
            throw ApplicationError.badRequest(ErrorCodes.TEAM_INVITATION_ALREADY_SENT, 'Invitation already sent to this email');
        }

        const role = input.roleId
            ? await this.#roles.findById(input.roleId)
            : await this.#roles.findOne({ name: 'Member', team: teamId });
        if (!role) {
            throw ApplicationError.notFound(ErrorCodes.TEAM_ROLE_NOT_FOUND, 'Team role not found');
        }

        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

        const invitation = await this.#invitations.create({
            team: teamId,
            invitedBy: userId,
            invitedUser: user.id,
            email: normalizedEmail,
            token,
            role: role._id,
            expiresAt,
            status: TeamInvitationStatus.Pending
        });

        const invitationTeam = await this.#teams.findById(invitation.getTeamId());
        await this.#eventBus.publish(new InvitationSentEvent({
            invitationId: invitation._id,
            teamName: invitationTeam?.props.name ?? '',
            invitedUserId: invitation.getInvitedUserId()
        }));

        return toPersistedOutput(invitation);
    }

    async listByTeamId(teamId: string, page = 1, limit = 10): Promise<PaginatedResult<PersistedOutput<TeamInvitationProps>>> {
        const result = await this.#invitations.findAll({
            filter: { team: teamId, status: TeamInvitationStatus.Pending },
            populate: { path: 'invitedUser' },
            page,
            limit
        });
        return { ...result, data: result.data.map((invitation) => toPersistedOutput(invitation)) };
    }

    async deleteById(invitationId: string): Promise<void> {
        const deleted = await this.#invitations.deleteById(invitationId);
        if (!deleted) {
            throw ApplicationError.notFound(ErrorCodes.TEAM_INVITATION_NOT_FOUND, 'TeamInvitation not found');
        }
    }

    async updateById(invitationId: string, data: UpdateTeamInvitationInput): Promise<PersistedOutput<TeamInvitationProps>> {
        const entity = await this.#invitations.updateById(invitationId, data as Partial<TeamInvitationProps>);
        if (!entity) {
            throw ApplicationError.notFound(ErrorCodes.TEAM_INVITATION_NOT_FOUND, 'TeamInvitation not found');
        }
        return toPersistedOutput(entity);
    }

    async getByIdPublic(invitationId: string): Promise<PersistedOutput<TeamInvitationProps>> {
        const invitation = await this.#invitations.findById(invitationId, {
            populate: { path: 'invitedBy team', select: ['firstName', 'lastName', 'name', '_id'] }
        });
        if (!invitation) {
            throw ApplicationError.notFound(ErrorCodes.TEAM_INVITATION_NOT_FOUND, 'TeamInvitation not found');
        }
        return toPersistedOutput(invitation);
    }

    async accept(invitationId: string, userId: string): Promise<{ message: string }> {
        const invitation = await this.#invitations.findById(invitationId);
        if (!invitation) {
            throw ApplicationError.notFound(ErrorCodes.TEAM_INVITATION_NOT_FOUND, 'Invitation not found');
        }
        if (!invitation.isPending()) {
            throw ApplicationError.badRequest(ErrorCodes.TEAM_INVITATION_ALREADY_PROCESSED, 'Invitation has already been processed');
        }
        if (invitation.isExpired()) {
            throw ApplicationError.badRequest(ErrorCodes.TEAM_INVITATION_EXPIRED, 'Invitation has expired');
        }
        if (invitation.getInvitedUserId() !== userId) {
            throw ApplicationError.forbidden(ErrorCodes.TEAM_INVITATION_INVALID_USER, 'This invitation was not sent to you');
        }

        const teamId = invitation.getTeamId();
        const ownerRole = await this.#roles.findOne({ name: SystemRoleNames.OWNER, team: teamId });
        if (!ownerRole) {
            throw ApplicationError.notFound(ErrorCodes.TEAM_ROLE_NOT_FOUND, 'Owner role not found');
        }

        await this.#members.create({ team: teamId, user: userId, role: ownerRole._id, joinedAt: new Date() });
        await this.#users.addTeamToUser(userId, teamId);
        await this.#invitations.updateById(invitation._id, invitation.accept());

        return { message: 'Invitation accepted successfully' };
    }

    async reject(invitationId: string, userId: string): Promise<{ message: string }> {
        const invitation = await this.#invitations.findById(invitationId);
        if (!invitation) {
            throw ApplicationError.notFound(ErrorCodes.TEAM_INVITATION_NOT_FOUND, 'Invitation not found');
        }
        if (!invitation.isPending()) {
            throw ApplicationError.badRequest(ErrorCodes.TEAM_INVITATION_ALREADY_PROCESSED, 'Invitation has already been processed');
        }
        if (invitation.getInvitedUserId() !== userId) {
            throw ApplicationError.forbidden(ErrorCodes.TEAM_INVITATION_INVALID_USER, 'This invitation was not sent to you');
        }

        await this.#invitations.updateById(invitation._id, invitation.reject());

        return { message: 'Invitation rejected successfully' };
    }
}
