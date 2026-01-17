import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@/src/shared/application/IUseCase';
import { Result } from '@/src/shared/domain/ports/Result';
import ApplicationError from '@/src/shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@/src/core/constants/error-codes';
import { TEAM_TOKENS } from '../../../infrastructure/di/TeamTokens';
import { ITeamInvitationRepository } from '../../../domain/ports/ITeamInvitationRepository';
import { TeamInvitationStatus } from '../../../domain/entities/TeamInvitation';
import { CancelInvitationInputDTO, CancelInvitationOutputDTO } from '../../dtos/team-invitation/CancelInvitationDTO';

@injectable()
export default class CancelInvitationUseCase implements IUseCase<CancelInvitationInputDTO, CancelInvitationOutputDTO, ApplicationError> {
    constructor(
        @inject(TEAM_TOKENS.TeamInvitationRepository)
        private readonly invitationRepository: ITeamInvitationRepository
    ) { }

    async execute(input: CancelInvitationInputDTO): Promise<Result<CancelInvitationOutputDTO, ApplicationError>> {
        const { teamId, invitationId } = input;

        const invitation = await this.invitationRepository.findById(invitationId);

        if (!invitation || invitation.props.team !== teamId || invitation.props.status !== TeamInvitationStatus.Pending) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.TEAM_INVITATION_NOT_FOUND,
                'Invitation not found or already processed'
            ));
        }

        const updatedInvitation = await this.invitationRepository.updateById(invitationId, {
            status: 'rejected' as any
        });

        if (!updatedInvitation) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.TEAM_INVITATION_NOT_FOUND,
                'Failed to cancel invitation'
            ));
        }

        return Result.ok(updatedInvitation.props);
    }
}
