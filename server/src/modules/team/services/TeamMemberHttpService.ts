import DeleteTeamMemberByIdUseCase from '@modules/team/use-cases/team-member/DeleteTeamMemberByIdUseCase';
import ListTeamMembersByTeamIdUseCase from '@modules/team/use-cases/team-member/ListTeamMembersByTeamIdUseCase';
import UpdateTeamMemberByIdUseCase from '@modules/team/use-cases/team-member/UpdateTeamMemberByIdUseCase';
import { TEAM_TOKENS } from '@modules/team/di/TeamTokens';
import type { UseCaseInput, UseCaseOutput } from '@shared/application/IUseCase';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

/**
 * The HTTP-facing application service for the team-member resource. Thin
 * delegators to retained use cases, returning each use case's value and letting a thrown
 * `ApplicationError` reach the global `httpErrorMiddleware`. See {@link TeamHttpService} for the shared rationale.
 */
@Singleton(TEAM_TOKENS.TeamMemberHttpService)
export default class TeamMemberHttpService {
    constructor(
        @inject(DeleteTeamMemberByIdUseCase) private readonly deleteTeamMemberByIdUseCase: DeleteTeamMemberByIdUseCase,
        @inject(ListTeamMembersByTeamIdUseCase) private readonly listTeamMembersByTeamIdUseCase: ListTeamMembersByTeamIdUseCase,
        @inject(UpdateTeamMemberByIdUseCase) private readonly updateTeamMemberByIdUseCase: UpdateTeamMemberByIdUseCase
    ) {}

    deleteById(
        input: UseCaseInput<DeleteTeamMemberByIdUseCase>
    ): Promise<UseCaseOutput<DeleteTeamMemberByIdUseCase>> {
        return this.deleteTeamMemberByIdUseCase.execute(input);
    }

    listByTeamId(
        input: UseCaseInput<ListTeamMembersByTeamIdUseCase>
    ): Promise<UseCaseOutput<ListTeamMembersByTeamIdUseCase>> {
        return this.listTeamMembersByTeamIdUseCase.execute(input);
    }

    updateById(
        input: UseCaseInput<UpdateTeamMemberByIdUseCase>
    ): Promise<UseCaseOutput<UpdateTeamMemberByIdUseCase>> {
        return this.updateTeamMemberByIdUseCase.execute(input);
    }
}
