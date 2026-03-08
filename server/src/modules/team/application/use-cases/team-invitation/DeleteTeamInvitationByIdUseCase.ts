import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import type { ITeamInvitationRepository } from '@modules/team/domain/port/ITeamInvitationRepository';
import { TEAM_TOKENS } from '@modules/team/application/di/TeamTokens';
import { ErrorCodes } from '@core/constants/error-codes';

interface DeleteTeamInvitationByIdInput {
    invitationId: string;
}

interface DeleteTeamInvitationByIdOutput {
    success: boolean;
}

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
}
