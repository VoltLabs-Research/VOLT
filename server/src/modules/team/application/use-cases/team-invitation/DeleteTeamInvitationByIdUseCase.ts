import type TeamInvitationRepository from '@modules/team/infrastructure/persistence/mongo/repositories/team-invitation/TeamInvitationRepository';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import { ErrorCodes } from '@core/constants/error-codes';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { inject, injectable } from 'tsyringe';

interface DeleteTeamInvitationByIdInput {
    invitationId: string;
}

interface DeleteTeamInvitationByIdOutput {
    success: boolean;
}

@injectable()
export default class DeleteTeamInvitationByIdUseCase implements IUseCase<DeleteTeamInvitationByIdInput, DeleteTeamInvitationByIdOutput, ApplicationError> {
    constructor(
        @inject(TEAM_TOKENS.TeamInvitationRepository) private readonly repository: TeamInvitationRepository
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
