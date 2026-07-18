import type { ITeamInvitationRepository } from '@modules/team/ports/team-invitation/ITeamInvitationRepository';
import { TEAM_TOKENS } from '@modules/team/di/TeamTokens';
import { ErrorCodes } from '@core/constants/error-codes';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { inject, injectable } from 'tsyringe';

interface DeleteTeamInvitationByIdInput {
    invitationId: string;
}

interface DeleteTeamInvitationByIdOutput {
    success: boolean;
}

@injectable()
export default class DeleteTeamInvitationByIdUseCase implements IUseCase<DeleteTeamInvitationByIdInput, DeleteTeamInvitationByIdOutput> {
    constructor(
        @inject(TEAM_TOKENS.TeamInvitationRepository) private readonly repository: ITeamInvitationRepository
    ) {}

    async execute(input: DeleteTeamInvitationByIdInput): Promise<DeleteTeamInvitationByIdOutput> {
        const deleted = await this.repository.deleteById(input.invitationId);
        if (!deleted) {
            throw ApplicationError.notFound(
                ErrorCodes.TEAM_INVITATION_NOT_FOUND,
                'TeamInvitation not found'
            );
        }
        return { success: true };
    }
}
