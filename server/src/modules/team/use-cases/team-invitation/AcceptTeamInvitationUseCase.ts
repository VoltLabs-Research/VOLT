import type { ITeamRoleRepository } from '@modules/team/ports/team-role/ITeamRoleRepository';
import type { ITeamInvitationRepository } from '@modules/team/ports/team-invitation/ITeamInvitationRepository';
import { AUTH_CONTRACT_TOKENS } from '@shared/contracts/tokens/AuthTokens';
import type { IUserRepository } from '@modules/auth/ports/IUserRepository';
import { TEAM_TOKENS } from '@modules/team/di/TeamTokens';
import type { ITeamMemberRepository } from '@modules/team/ports/team-member/ITeamMemberRepository';
import { ErrorCodes } from '@core/constants/error-codes';
import { SystemRoleNames } from '@core/constants/system-roles';
import { AcceptTeamInvitationInputDTO, AcceptTeamInvitationOutputDTO } from '@modules/team/dtos/team-invitation/AcceptTeamInvitationDTO';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { inject, injectable } from 'tsyringe';

@injectable()
export default class AcceptTeamInvitationUseCase implements IUseCase<AcceptTeamInvitationInputDTO, AcceptTeamInvitationOutputDTO> {
    constructor(
        @inject(TEAM_TOKENS.TeamInvitationRepository) private readonly invitationRepository: ITeamInvitationRepository,
        @inject(TEAM_TOKENS.TeamMemberRepository) private readonly teamMemberRepository: ITeamMemberRepository,
        @inject(TEAM_TOKENS.TeamRoleRepository) private readonly teamRoleRepository: ITeamRoleRepository,
        @inject(AUTH_CONTRACT_TOKENS.UserRepository) private readonly userRepository: IUserRepository
    ){}

    async execute(input: AcceptTeamInvitationInputDTO): Promise<AcceptTeamInvitationOutputDTO> {
        const { invitationId, userId } = input;

        const invitation = await this.invitationRepository.findById(invitationId);
        if (!invitation) {
            throw ApplicationError.notFound(
                ErrorCodes.TEAM_INVITATION_NOT_FOUND,
                'Invitation not found'
            );
        }

        if (!invitation.isPending()) {
            throw ApplicationError.badRequest(
                ErrorCodes.TEAM_INVITATION_ALREADY_PROCESSED,
                'Invitation has already been processed'
            );
        }

        if (invitation.isExpired()) {
            throw ApplicationError.badRequest(
                ErrorCodes.TEAM_INVITATION_EXPIRED,
                'Invitation has expired'
            );
        }

        if (invitation.getInvitedUserId() !== userId) {
            throw ApplicationError.forbidden(
                ErrorCodes.TEAM_INVITATION_INVALID_USER,
                'This invitation was not sent to you'
            );
        }

        const teamId = invitation.getTeamId();
        const ownerRole = await this.teamRoleRepository.findOne({ name: SystemRoleNames.OWNER, team: teamId });
        if (!ownerRole) {
            throw ApplicationError.notFound(
                ErrorCodes.TEAM_ROLE_NOT_FOUND,
                'Owner role not found'
            );
        }

        await this.teamMemberRepository.create({
            team: teamId,
            user: userId,
            role: ownerRole._id,
            joinedAt: new Date()
        });

        await this.userRepository.addTeamToUser(userId, teamId);

        await this.invitationRepository.updateById(invitation._id, invitation.accept());

        return {
            message: 'Invitation accepted successfully'
        };
    }
}
