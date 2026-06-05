import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import type { ITeamMemberRepository } from '@modules/team/domain/port/team-member/ITeamMemberRepository';
import type { ITeamRepository } from '@modules/team/domain/port/team/ITeamRepository';
import { DeleteTeamInviteCodeInputDTO, DeleteTeamInviteCodeOutputDTO } from '@modules/team/application/dtos/team/DeleteTeamInviteCodeDTO';
import { getInviteCodePermissionError } from '@modules/team/application/use-cases/team/invite-code-helpers';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { inject, injectable } from 'tsyringe';

@injectable()
export default class DeleteTeamInviteCodeUseCase implements IUseCase<DeleteTeamInviteCodeInputDTO, DeleteTeamInviteCodeOutputDTO, ApplicationError> {
    constructor(
        @inject(TEAM_TOKENS.TeamRepository) private readonly teamRepository: ITeamRepository,
        @inject(TEAM_TOKENS.TeamMemberRepository) private readonly teamMemberRepository: ITeamMemberRepository
    ) {}

    async execute(input: DeleteTeamInviteCodeInputDTO): Promise<Result<DeleteTeamInviteCodeOutputDTO, ApplicationError>> {
        const { teamId, userId } = input;

        const permissionError = await getInviteCodePermissionError(this.teamMemberRepository, teamId, userId);
        if (permissionError) {
            return Result.fail(permissionError);
        }

        await this.teamRepository.clearInviteCode(teamId);

        return Result.ok({ message: 'Invite code deleted successfully' });
    }
}
