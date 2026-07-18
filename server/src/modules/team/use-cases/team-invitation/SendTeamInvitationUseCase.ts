import type { ITeamRoleRepository } from '@modules/team/ports/team-role/ITeamRoleRepository';
import type { ITeamInvitationRepository } from '@modules/team/ports/team-invitation/ITeamInvitationRepository';
import { AUTH_CONTRACT_TOKENS } from '@shared/contracts/tokens/AuthTokens';
import type { IUserRepository } from '@modules/auth/ports/IUserRepository';
import { TEAM_TOKENS } from '@modules/team/di/TeamTokens';
import type { ITeamMemberRepository } from '@modules/team/ports/team-member/ITeamMemberRepository';
import type { ITeamRepository } from '@modules/team/ports/team/ITeamRepository';
import { ErrorCodes } from '@core/constants/error-codes';
import { SendTeamInvitationInputDTO, SendTeamInvitationOutputDTO } from '@modules/team/dtos/team-invitation/SendTeamInvitationDTO';
import TeamInvitation, { TeamInvitationStatus } from '@modules/team/entities/team-invitation/TeamInvitation';
import InvitationSentEvent from '@modules/team/events/team-invitation/InvitationSentEvent';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IEventBus } from '@shared/application/events/IEventBus';
import { IUseCase } from '@shared/application/IUseCase';
import { toPersistedOutput } from '@shared/domain/port/PersistedEntity';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import crypto from 'crypto';
import { inject, injectable } from 'tsyringe';

@injectable()
export default class SendTeamInvitationUseCase implements IUseCase<SendTeamInvitationInputDTO, SendTeamInvitationOutputDTO> {
    constructor(
        @inject(TEAM_TOKENS.TeamInvitationRepository) private readonly invitationRepository: ITeamInvitationRepository,
        @inject(TEAM_TOKENS.TeamRepository) private readonly teamRepository: ITeamRepository,
        @inject(AUTH_CONTRACT_TOKENS.UserRepository) private readonly userRepository: IUserRepository,
        @inject(TEAM_TOKENS.TeamRoleRepository) private readonly teamRoleRepository: ITeamRoleRepository,
        @inject(TEAM_TOKENS.TeamMemberRepository) private readonly teamMemberRepository: ITeamMemberRepository,
        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus
    ){}

    async execute(input: SendTeamInvitationInputDTO): Promise<SendTeamInvitationOutputDTO> {
        const { teamId, userId, email, roleId } = input;
        const normalizedEmail = TeamInvitation.normalizeEmail(email);

        const team = await this.teamRepository.findById(teamId);
        if (!team) {
            throw ApplicationError.notFound(
                ErrorCodes.TEAM_NOT_FOUND,
                'Team not found'
            );
        }

        const user = await this.userRepository.findByEmail(normalizedEmail);
        if (!user) {
            throw ApplicationError.notFound(
                ErrorCodes.USER_NOT_FOUND,
                'User not found'
            );
        }

        const isMember = await this.teamMemberRepository.findOne({
            team: teamId,
            user: user.id
        });

        if (isMember) {
            throw ApplicationError.badRequest(
                ErrorCodes.TEAM_INVITATION_USER_ALREADY_MEMBER,
                'User is already a member of this team'
            );
        }

        const existingInvitation = await this.invitationRepository.findOne({
            team: teamId,
            email: normalizedEmail,
            status: TeamInvitationStatus.Pending
        });

        if (existingInvitation) {
            throw ApplicationError.badRequest(
                ErrorCodes.TEAM_INVITATION_ALREADY_SENT,
                'Invitation already sent to this email'
            );
        }

        const role = roleId
            ? await this.teamRoleRepository.findById(roleId)
            : await this.teamRoleRepository.findOne({ name: 'Member', team: teamId });
        if (!role) {
            throw ApplicationError.notFound(
                ErrorCodes.TEAM_ROLE_NOT_FOUND,
                'Team role not found'
            );
        }

        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

        const invitation = await this.invitationRepository.create({
            team: teamId,
            invitedBy: userId,
            invitedUser: user.id,
            email: normalizedEmail,
            token,
            role: role._id,
            expiresAt,
            status: TeamInvitationStatus.Pending
        });

        const invitationTeam = await this.teamRepository.findById(invitation.getTeamId());
        await this.eventBus.publish(new InvitationSentEvent({
            invitationId: invitation._id,
            teamName: invitationTeam?.props.name ?? '',
            invitedUserId: invitation.getInvitedUserId()
        }));

        return toPersistedOutput(invitation);
    }
}
