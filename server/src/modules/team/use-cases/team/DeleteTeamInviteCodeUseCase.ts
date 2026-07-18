import { TEAM_TOKENS } from '@modules/team/di/TeamTokens';
import type { ITeamMemberRepository } from '@modules/team/ports/team-member/ITeamMemberRepository';
import type { ITeamRepository } from '@modules/team/ports/team/ITeamRepository';
import { DeleteTeamInviteCodeInputDTO, DeleteTeamInviteCodeOutputDTO } from '@modules/team/dtos/team/DeleteTeamInviteCodeDTO';
import { getInviteCodePermissionError } from '@modules/team/use-cases/team/invite-code-helpers';
import { IUseCase } from '@shared/application/IUseCase';
import { inject, injectable } from 'tsyringe';

@injectable()
export default class DeleteTeamInviteCodeUseCase implements IUseCase<DeleteTeamInviteCodeInputDTO, DeleteTeamInviteCodeOutputDTO> {
    constructor(
        @inject(TEAM_TOKENS.TeamRepository) private readonly teamRepository: ITeamRepository,
        @inject(TEAM_TOKENS.TeamMemberRepository) private readonly teamMemberRepository: ITeamMemberRepository
    ) {}

    async execute(input: DeleteTeamInviteCodeInputDTO): Promise<DeleteTeamInviteCodeOutputDTO> {
        const { teamId, userId } = input;

        const permissionError = await getInviteCodePermissionError(this.teamMemberRepository, teamId, userId);
        if (permissionError) {
            throw permissionError;
        }

        await this.teamRepository.clearInviteCode(teamId);

        return { message: 'Invite code deleted successfully' };
    }
}
