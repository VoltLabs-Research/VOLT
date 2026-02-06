import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/ports/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@core/constants/error-codes';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import { ITeamInvitationRepository } from '@modules/team/domain/ports/ITeamInvitationRepository';
import { TeamInvitationStatus } from '@modules/team/domain/entities/TeamInvitation';

export interface RejectTeamInvitationInputDTO {
    invitationId: string;
    userId: string;
}

export interface RejectTeamInvitationOutputDTO {
    message: string;
}

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

        if (invitation.props.status !== TeamInvitationStatus.Pending) {
            return Result.fail(ApplicationError.badRequest(
                ErrorCodes.TEAM_INVITATION_ALREADY_PROCESSED,
                'Invitation has already been processed'
            ));
        }

        // Verify the user rejecting is the one invited
        const invitedUserId = typeof invitation.props.invitedUser === 'object'
            ? (invitation.props.invitedUser as any).id || (invitation.props.invitedUser as any)._id
            : invitation.props.invitedUser;

        if (invitedUserId.toString() !== userId) {
            return Result.fail(ApplicationError.forbidden(
                ErrorCodes.TEAM_INVITATION_INVALID_USER,
                'This invitation was not sent to you'
            ));
        }

        // Update Status to Rejected
        invitation.props.status = TeamInvitationStatus.Rejected;
        await this.invitationRepository.updateById(invitation.id, invitation.props);

        return Result.ok({ message: 'Invitation rejected successfully' });
    }
}
