import { ErrorCodes } from '@core/constants/error-codes';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { injectable, inject } from 'tsyringe';
import type { ITeamInvitationRepository } from '@modules/team/domain/port/team-invitation/ITeamInvitationRepository';

interface DeleteTeamInvitationByIdInput {
    invitationId: string;
};

interface DeleteTeamInvitationByIdOutput {
    success: boolean;
};

@injectable()
export default class DeleteTeamInvitationByIdUseCase implements IUseCase<DeleteTeamInvitationByIdInput, DeleteTeamInvitationByIdOutput, ApplicationError> {
    constructor(
        @inject(TEAM_TOKENS.TeamInvitationRepository)
        private readonly repository: ITeamInvitationRepository
    ) {}

    async execute(input: DeleteTeamInvitationByIdInput): Promise<Result<DeleteTeamInvitationByIdOutput, ApplicationError>> {
        const deleted = await this.repository.deleteById(input.invitationId);
        if (!deleted) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.TEAM_INVITATION_NOT_FOUND,
                'TeamInvitation not found'
            ));
        }
        return Result.ok({ success: true });
    }
};
