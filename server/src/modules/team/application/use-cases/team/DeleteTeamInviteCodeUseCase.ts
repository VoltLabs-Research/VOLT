import { DeleteTeamInviteCodeInputDTO, DeleteTeamInviteCodeOutputDTO } from '@modules/team/application/dtos/team/DeleteTeamInviteCodeDTO';
import { getInviteCodePermissionError } from '@modules/team/application/use-cases/team/invite-code-helpers';
import TeamMemberRepository from '@modules/team/infrastructure/persistence/mongo/repositories/team-member/TeamMemberRepository';
import TeamRepository from '@modules/team/infrastructure/persistence/mongo/repositories/team/TeamRepository';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { injectable } from 'tsyringe';

@injectable()
export default class DeleteTeamInviteCodeUseCase implements IUseCase<DeleteTeamInviteCodeInputDTO, DeleteTeamInviteCodeOutputDTO, ApplicationError> {
    constructor(
        
        private readonly teamRepository: TeamRepository,

        
        private readonly teamMemberRepository: TeamMemberRepository
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
};
