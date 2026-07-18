import CreateTeamRoleUseCase from '@modules/team/application/use-cases/team-role/CreateTeamRoleUseCase';
import DeleteTeamRoleByIdUseCase from '@modules/team/application/use-cases/team-role/DeleteTeamRoleByIdUseCase';
import UpdateTeamRoleByIdUseCase from '@modules/team/application/use-cases/team-role/UpdateTeamRoleByIdUseCase';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import type { UseCaseInput, UseCaseOutput } from '@shared/application/IUseCase';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

/**
 * The HTTP-facing application service for the team-role resource. Thin
 * delegators to retained use cases, returning each use case's value and letting a thrown
 * `ApplicationError` reach the global `httpErrorMiddleware`. See {@link TeamHttpService} for the shared rationale.
 */
@Singleton(TEAM_TOKENS.TeamRoleHttpService)
export default class TeamRoleHttpService {
    constructor(
        @inject(CreateTeamRoleUseCase) private readonly createTeamRoleUseCase: CreateTeamRoleUseCase,
        @inject(DeleteTeamRoleByIdUseCase) private readonly deleteTeamRoleByIdUseCase: DeleteTeamRoleByIdUseCase,
        @inject(UpdateTeamRoleByIdUseCase) private readonly updateTeamRoleByIdUseCase: UpdateTeamRoleByIdUseCase
    ) {}

    create(
        input: UseCaseInput<CreateTeamRoleUseCase>
    ): Promise<UseCaseOutput<CreateTeamRoleUseCase>> {
        return this.createTeamRoleUseCase.execute(input);
    }

    deleteById(
        input: UseCaseInput<DeleteTeamRoleByIdUseCase>
    ): Promise<UseCaseOutput<DeleteTeamRoleByIdUseCase>> {
        return this.deleteTeamRoleByIdUseCase.execute(input);
    }

    updateById(
        input: UseCaseInput<UpdateTeamRoleByIdUseCase>
    ): Promise<UseCaseOutput<UpdateTeamRoleByIdUseCase>> {
        return this.updateTeamRoleByIdUseCase.execute(input);
    }
}
