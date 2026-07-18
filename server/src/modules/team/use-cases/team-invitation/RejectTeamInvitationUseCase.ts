import type { ITeamInvitationRepository } from '@modules/team/ports/team-invitation/ITeamInvitationRepository';
import { TEAM_TOKENS } from '@modules/team/di/TeamTokens';
import { ErrorCodes } from '@core/constants/error-codes';
import { RejectTeamInvitationInputDTO, RejectTeamInvitationOutputDTO } from '@modules/team/dtos/team-invitation/RejectTeamInvitationDTO';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { inject, injectable } from 'tsyringe';

@injectable()
export default class RejectTeamInvitationUseCase implements IUseCase<RejectTeamInvitationInputDTO, RejectTeamInvitationOutputDTO> {
    constructor(
        @inject(TEAM_TOKENS.TeamInvitationRepository) private readonly invitationRepository: ITeamInvitationRepository
    ){}

    async execute(input: RejectTeamInvitationInputDTO): Promise<RejectTeamInvitationOutputDTO> {
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

        if (invitation.getInvitedUserId() !== userId) {
            throw ApplicationError.forbidden(
                ErrorCodes.TEAM_INVITATION_INVALID_USER,
                'This invitation was not sent to you'
            );
        }

        await this.invitationRepository.updateById(invitation._id, invitation.reject());

        return {
            message: 'Invitation rejected successfully'
        };
    }
}
