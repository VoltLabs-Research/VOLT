import eventBus from '@shared/infrastructure/events/RedisEventBus';
import { ErrorCodes } from '@core/constants/error-codes';
import { SystemRoleNames } from '@core/constants/system-roles';
import User from '@modules/auth/models/User';
import Team from '@modules/team/models/Team';
import TeamInvitation from '@modules/team/models/TeamInvitation';
import TeamMember from '@modules/team/models/TeamMember';
import TeamRole from '@modules/team/models/TeamRole';
import { TeamInvitationStatus } from '@volt/contracts/modules/team/domain';
import { addTeamToUser } from '@modules/team/services/team/user-team-links';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { paginate, readPageRequest, skipFor } from '@shared/infrastructure/persistence/paginate';
import type { PaginatedResult } from '@shared/domain/port/persistence';
import crypto from 'crypto';
import type {
    SendTeamInvitationInput,
    TeamInvitationStatusInput,
    UpdateTeamInvitationInput
} from '@volt/contracts/modules/team/http';

const DEFAULT_INVITATION_LIMIT = 10;
const INVITATION_TTL_MS = 24 * 60 * 60 * 1000;

const assertInvitedUser = (invitation: TeamInvitation, userId: string): void => {
    if(invitation.invitedUser !== userId){
        throw ApplicationError.forbidden(ErrorCodes.TEAM_INVITATION_INVALID_USER, 'This invitation was not sent to you');
    }
};

export default class TeamInvitationService{
    async send(teamId: string, userId: string, input: SendTeamInvitationInput): Promise<TeamInvitation>{
        const normalizedEmail = input.email.trim().toLowerCase();

        const team = await Team.findOneBy({ id: teamId });
        if(!team){
            throw ApplicationError.notFound(ErrorCodes.TEAM_NOT_FOUND, 'Team not found');
        }

        const user = await User.findOneBy({ email: normalizedEmail });
        if(!user){
            throw ApplicationError.notFound(ErrorCodes.USER_NOT_FOUND, 'User not found');
        }

        const isMember = await TeamMember.findOneBy({
            team: teamId,
            user: user.id
        });
        if(isMember){
            throw ApplicationError.badRequest(ErrorCodes.TEAM_INVITATION_USER_ALREADY_MEMBER, 'User is already a member of this team');
        }

        const existingInvitation = await TeamInvitation.findOneBy({
            team: teamId,
            email: normalizedEmail,
            status: TeamInvitationStatus.Pending
        });
        if(existingInvitation){
            throw ApplicationError.badRequest(ErrorCodes.TEAM_INVITATION_ALREADY_SENT, 'Invitation already sent to this email');
        }

        const role = input.roleId
            ? await TeamRole.findOneBy({ id: input.roleId })
            : await TeamRole.findOneBy({
                name: 'Member',
                team: teamId
            });
        if(!role){
            throw ApplicationError.notFound(ErrorCodes.TEAM_ROLE_NOT_FOUND, 'Team role not found');
        }

        const invitation = await TeamInvitation.create({
            team: teamId,
            invitedBy: userId,
            invitedUser: user.id,
            email: normalizedEmail,
            token: crypto.randomBytes(32).toString('hex'),
            role: role.id,
            expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
            status: TeamInvitationStatus.Pending
        }).save();

        await eventBus.emit('invitation.sent', {
            invitationId: invitation.id,
            teamName: team.name,
            invitedUserId: invitation.invitedUser ?? ''
        });

        return invitation;
    }

    async listByTeamId(teamId: string, page = 1, limit = DEFAULT_INVITATION_LIMIT): Promise<PaginatedResult<TeamInvitation>>{
        const pageRequest = readPageRequest(page, limit, { defaultLimit: DEFAULT_INVITATION_LIMIT });

        const [invitations, total] = await TeamInvitation.findAndCount({
            where: {
                team: teamId,
                status: TeamInvitationStatus.Pending
            },
            relations: { invitedUserRef: true },
            skip: skipFor(pageRequest),
            take: pageRequest.limit
        });

        return paginate([invitations, total], pageRequest);
    }

    async deleteById(teamId: string, invitationId: string): Promise<void>{
        const invitation = await this.#requireInvitation(teamId, invitationId);
        await invitation.remove();
    }

    async updateById(teamId: string, invitationId: string, data: UpdateTeamInvitationInput): Promise<TeamInvitation>{
        const invitation = await this.#requireInvitation(teamId, invitationId);
        return Object.assign(invitation, data as Partial<TeamInvitation>).save();
    }

    async #requireInvitation(teamId: string, invitationId: string): Promise<TeamInvitation>{
        const invitation = await TeamInvitation.findOneBy({
            id: invitationId,
            team: teamId
        });
        if(!invitation){
            throw ApplicationError.notFound(ErrorCodes.TEAM_INVITATION_NOT_FOUND, 'TeamInvitation not found');
        }
        return invitation;
    }

    async getByIdPublic(invitationId: string): Promise<Record<string, unknown>>{
        const invitation = await TeamInvitation.findOne({
            where: { id: invitationId },
            relations: {
                invitedByRef: true,
                teamRef: true
            }
        });
        if(!invitation){
            throw ApplicationError.notFound(ErrorCodes.TEAM_INVITATION_NOT_FOUND, 'TeamInvitation not found');
        }

        const { invitedByRef, teamRef } = invitation;

        return {
            ...invitation.toJSON(),
            invitedBy: !invitedByRef
                ? invitation.invitedBy
                : {
                    _id: invitedByRef.id,
                    firstName: invitedByRef.firstName,
                    lastName: invitedByRef.lastName
                },
            team: !teamRef
                ? invitation.team
                : {
                    _id: teamRef.id,
                    name: teamRef.name
                }
        };
    }

    async updateStatus(
        invitationId: string,
        userId: string,
        input: TeamInvitationStatusInput,
        teamId?: string
    ): Promise<{ message: string }>{
        return input.status === 'accepted'
            ? this.accept(invitationId, userId, teamId)
            : this.reject(invitationId, userId, teamId);
    }

    async accept(invitationId: string, userId: string, teamId?: string): Promise<{ message: string }>{
        const invitation = await this.#findPendingInvitation(invitationId, teamId);
        if(invitation.expiresAt < new Date()){
            throw ApplicationError.badRequest(ErrorCodes.TEAM_INVITATION_EXPIRED, 'Invitation has expired');
        }
        assertInvitedUser(invitation, userId);

        const ownerRole = await TeamRole.findOneBy({
            name: SystemRoleNames.OWNER,
            team: invitation.team
        });
        if(!ownerRole){
            throw ApplicationError.notFound(ErrorCodes.TEAM_ROLE_NOT_FOUND, 'Owner role not found');
        }

        await TeamMember.create({
            team: invitation.team,
            user: userId,
            role: ownerRole.id,
            joinedAt: new Date()
        }).save();
        await addTeamToUser(userId, invitation.team);
        await Object.assign(invitation, {
            status: TeamInvitationStatus.Accepted,
            acceptedAt: new Date()
        }).save();

        return { message: 'Invitation accepted successfully' };
    }

    async reject(invitationId: string, userId: string, teamId?: string): Promise<{ message: string }>{
        const invitation = await this.#findPendingInvitation(invitationId, teamId);
        assertInvitedUser(invitation, userId);
        await Object.assign(invitation, { status: TeamInvitationStatus.Rejected }).save();

        return { message: 'Invitation rejected successfully' };
    }

    async #findPendingInvitation(invitationId: string, teamId?: string): Promise<TeamInvitation>{
        const invitation = await TeamInvitation.findOneBy(teamId === undefined
            ? { id: invitationId }
            : {
                id: invitationId,
                team: teamId
            });
        if(!invitation){
            throw ApplicationError.notFound(ErrorCodes.TEAM_INVITATION_NOT_FOUND, 'Invitation not found');
        }
        if(invitation.status !== TeamInvitationStatus.Pending){
            throw ApplicationError.badRequest(ErrorCodes.TEAM_INVITATION_ALREADY_PROCESSED, 'Invitation has already been processed');
        }

        return invitation;
    }
}
