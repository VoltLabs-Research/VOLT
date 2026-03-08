import { injectable, inject } from 'tsyringe';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@core/constants/error-codes';
import { TEAM_TOKENS } from '@modules/team/application/di/TeamTokens';
import { ITeamInvitationRepository } from '@modules/team/domain/port/ITeamInvitationRepository';
import { RejectTeamInvitationInputDTO, RejectTeamInvitationOutputDTO } from '@modules/team/application/dtos/team-invitation/RejectTeamInvitationDTO';
import { IUseCase } from '@shared/application/IUseCase';

@injectable()
export default class RejectTeamInvitationUseCase implements IUseCase<RejectTeamInvitationInputDTO, RejectTeamInvitationOutputDTO, ApplicationError> {
    constructor(
        @inject(TEAM_TOKENS.TeamInvitationRepository)
        private readonly invitationRepository: ITeamInvitationRepository
    ){}

    async execute(input: RejectTeamInvitationInputDTO): Promise<Result<RejectTeamInvitationOutputDTO, ApplicationError>> {
        const { invitationId, userId } = input;

        const invitation = await this.invitationRepository.findById(invitationId);
        if (!invitation) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.TEAM_INVITATION_NOT_FOUND,
                'Invitation not found'
            ));
        }

        if (!invitation.isPending()) {
            return Result.fail(ApplicationError.badRequest(
                ErrorCodes.TEAM_INVITATION_ALREADY_PROCESSED,
                'Invitation has already been processed'
            ));
        }

        if (invitation.getInvitedUserId() !== userId) {
            return Result.fail(ApplicationError.forbidden(
                ErrorCodes.TEAM_INVITATION_INVALID_USER,
                'This invitation was not sent to you'
            ));
        }

        await this.invitationRepository.updateById(invitation._id, invitation.reject());

        return Result.ok({
            message: 'Invitation rejected successfully'
        });
    }
}
