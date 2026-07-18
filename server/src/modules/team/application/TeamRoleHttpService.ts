import CreateTeamRoleUseCase from '@modules/team/application/use-cases/team-role/CreateTeamRoleUseCase';
import DeleteTeamRoleByIdUseCase from '@modules/team/application/use-cases/team-role/DeleteTeamRoleByIdUseCase';
import UpdateTeamRoleByIdUseCase from '@modules/team/application/use-cases/team-role/UpdateTeamRoleByIdUseCase';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import type ApplicationError from '@shared/application/errors/ApplicationError';
import type { UseCaseInput, UseCaseOutput } from '@shared/application/IUseCase';
import type { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

/**
 * The HTTP-facing application service for the team-role resource. Thin
 * delegators to retained use cases, unwrapping the `Result` onto the
 * thrown-error channel. See {@link TeamHttpService} for the shared rationale.
 */
@Singleton(TEAM_TOKENS.TeamRoleHttpService)
export default class TeamRoleHttpService {
    constructor(
        @inject(CreateTeamRoleUseCase) private readonly createTeamRoleUseCase: CreateTeamRoleUseCase,
        @inject(DeleteTeamRoleByIdUseCase) private readonly deleteTeamRoleByIdUseCase: DeleteTeamRoleByIdUseCase,
        @inject(UpdateTeamRoleByIdUseCase) private readonly updateTeamRoleByIdUseCase: UpdateTeamRoleByIdUseCase
    ) {}

    private async run<T, E = ApplicationError>(execution: Promise<Result<T, E>>): Promise<T> {
        const result = await execution;
        if (!result.success) {
            throw result.error;
        }

        return result.value;
    }

    create(
        input: UseCaseInput<CreateTeamRoleUseCase>
    ): Promise<UseCaseOutput<CreateTeamRoleUseCase>> {
        return this.run(this.createTeamRoleUseCase.execute(input));
    }

    deleteById(
        input: UseCaseInput<DeleteTeamRoleByIdUseCase>
    ): Promise<UseCaseOutput<DeleteTeamRoleByIdUseCase>> {
        return this.run(this.deleteTeamRoleByIdUseCase.execute(input));
    }

    updateById(
        input: UseCaseInput<UpdateTeamRoleByIdUseCase>
    ): Promise<UseCaseOutput<UpdateTeamRoleByIdUseCase>> {
        return this.run(this.updateTeamRoleByIdUseCase.execute(input));
    }
}
