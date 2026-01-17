import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@/src/shared/application/IUseCase';
import { Result } from '@/src/shared/domain/ports/Result';
import ApplicationError from '@/src/shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@/src/core/constants/error-codes';
import { TEAM_TOKENS } from '../../../infrastructure/di/TeamTokens';
import { ITeamInvitationRepository } from '../../../domain/ports/ITeamInvitationRepository';
import { RejectTeamInvitationInputDTO, RejectTeamInvitationOutputDTO } from '../../dtos/team-invitation/RejectTeamInvitationDTO';

@injectable()
export default class RejectTeamInvitationUseCase implements IUseCase<RejectTeamInvitationInputDTO, RejectTeamInvitationOutputDTO, ApplicationError> {
    constructor(
        @inject(TEAM_TOKENS.TeamInvitationRepository)
        private readonly invitationRepository: ITeamInvitationRepository
    ) {}

    async execute(input: RejectTeamInvitationInputDTO): Promise<Result<RejectTeamInvitationOutputDTO, ApplicationError>> {
        const { invitationId } = input;

        const invitation = await this.invitationRepository.findById(invitationId);
        if (!invitation) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.TEAM_INVITATION_NOT_FOUND,
                'Invitation not found'
            ));
        }

        const updatedInvitation = await this.invitationRepository.updateById(invitationId, {
            status: 'rejected' as any
        });

        if (!updatedInvitation) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.TEAM_INVITATION_NOT_FOUND,
                'Failed to reject invitation'
            ));
        }

        return Result.ok(updatedInvitation.props);
    }
}
