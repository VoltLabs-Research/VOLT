import eventBus from '@shared/infrastructure/events/RedisEventBus';
import { ErrorCodes } from '@core/constants/error-codes';
import { SystemRoleNames } from '@core/constants/system-roles';
import User from '@modules/auth/models/User';
import Team from '@modules/team/models/Team';
import TeamInvitation from '@modules/team/models/TeamInvitation';
import TeamMember from '@modules/team/models/TeamMember';
import TeamRole from '@modules/team/models/TeamRole';
import {
    TeamInvitationStatus,
    isTeamInvitationExpired,
    isTeamInvitationPending,
    normalizeInvitationEmail
} from '@modules/team/contracts/domain/team-invitation';
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

export default class TeamInvitationService{
    #eventBus = eventBus;

    async send(teamId: string, userId: string, input: SendTeamInvitationInput): Promise<TeamInvitation>{
        const normalizedEmail = normalizeInvitationEmail(input.email);

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

        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

        const invitation = await TeamInvitation.create({
            team: teamId,
            invitedBy: userId,
            invitedUser: user.id,
            email: normalizedEmail,
            token,
            role: role.id,
            expiresAt,
            status: TeamInvitationStatus.Pending
        }).save();

        await this.#eventBus.emit('invitation.sent', {
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
        const invitation = await TeamInvitation.findOneBy({
            id: invitationId,
            team: teamId
        });
        if(!invitation){
            throw ApplicationError.notFound(ErrorCodes.TEAM_INVITATION_NOT_FOUND, 'TeamInvitation not found');
        }
        await invitation.remove();
    }

    async updateById(teamId: string, invitationId: string, data: UpdateTeamInvitationInput): Promise<TeamInvitation>{
        const invitation = await TeamInvitation.findOneBy({
            id: invitationId,
            team: teamId
        });
        if(!invitation){
            throw ApplicationError.notFound(ErrorCodes.TEAM_INVITATION_NOT_FOUND, 'TeamInvitation not found');
        }
        return Object.assign(invitation, data as Partial<TeamInvitation>).save();
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
        if(input?.status === 'accepted'){
            return this.accept(invitationId, userId, teamId);
        }
        if(input?.status === 'rejected'){
            return this.reject(invitationId, userId, teamId);
        }
        throw ApplicationError.badRequest(ErrorCodes.VALIDATION_INVALID_INPUT, 'Invalid status. Must be "accepted" or "rejected".');
    }

    async accept(invitationId: string, userId: string, teamId?: string): Promise<{ message: string }>{
        const invitation = await this.#findInvitation(invitationId, teamId);
        if(!invitation){
            throw ApplicationError.notFound(ErrorCodes.TEAM_INVITATION_NOT_FOUND, 'Invitation not found');
        }
        if(!isTeamInvitationPending(invitation)){
            throw ApplicationError.badRequest(ErrorCodes.TEAM_INVITATION_ALREADY_PROCESSED, 'Invitation has already been processed');
        }
        if(isTeamInvitationExpired(invitation)){
            throw ApplicationError.badRequest(ErrorCodes.TEAM_INVITATION_EXPIRED, 'Invitation has expired');
        }
        if(invitation.invitedUser !== userId){
            throw ApplicationError.forbidden(ErrorCodes.TEAM_INVITATION_INVALID_USER, 'This invitation was not sent to you');
        }

        const invitationTeamId = invitation.team;
        const ownerRole = await TeamRole.findOneBy({
            name: SystemRoleNames.OWNER,
            team: invitationTeamId
        });
        if(!ownerRole){
            throw ApplicationError.notFound(ErrorCodes.TEAM_ROLE_NOT_FOUND, 'Owner role not found');
        }

        await TeamMember.create({
            team: invitationTeamId,
            user: userId,
            role: ownerRole.id,
            joinedAt: new Date()
        }).save();
        await addTeamToUser(userId, invitationTeamId);
        await Object.assign(invitation, {
            status: TeamInvitationStatus.Accepted,
            acceptedAt: new Date()
        }).save();

        return { message: 'Invitation accepted successfully' };
    }

    async reject(invitationId: string, userId: string, teamId?: string): Promise<{ message: string }>{
        const invitation = await this.#findInvitation(invitationId, teamId);
        if(!invitation){
            throw ApplicationError.notFound(ErrorCodes.TEAM_INVITATION_NOT_FOUND, 'Invitation not found');
        }
        if(!isTeamInvitationPending(invitation)){
            throw ApplicationError.badRequest(ErrorCodes.TEAM_INVITATION_ALREADY_PROCESSED, 'Invitation has already been processed');
        }
        if(invitation.invitedUser !== userId){
            throw ApplicationError.forbidden(ErrorCodes.TEAM_INVITATION_INVALID_USER, 'This invitation was not sent to you');
        }

        await Object.assign(invitation, { status: TeamInvitationStatus.Rejected }).save();

        return { message: 'Invitation rejected successfully' };
    }

    async #findInvitation(invitationId: string, teamId?: string): Promise<TeamInvitation | null>{
        if(teamId === undefined){
            return TeamInvitation.findOneBy({ id: invitationId });
        }

        return TeamInvitation.findOneBy({
            id: invitationId,
            team: teamId
        });
    }
}
