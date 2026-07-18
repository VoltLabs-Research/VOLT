import DeleteTeamMemberByIdUseCase from '@modules/team/application/use-cases/team-member/DeleteTeamMemberByIdUseCase';
import ListTeamMembersByTeamIdUseCase from '@modules/team/application/use-cases/team-member/ListTeamMembersByTeamIdUseCase';
import UpdateTeamMemberByIdUseCase from '@modules/team/application/use-cases/team-member/UpdateTeamMemberByIdUseCase';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import type ApplicationError from '@shared/application/errors/ApplicationError';
import type { UseCaseInput, UseCaseOutput } from '@shared/application/IUseCase';
import type { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

/**
 * The HTTP-facing application service for the team-member resource. Thin
 * delegators to retained use cases, unwrapping the `Result` onto the
 * thrown-error channel. See {@link TeamHttpService} for the shared rationale.
 */
@Singleton(TEAM_TOKENS.TeamMemberHttpService)
export default class TeamMemberHttpService {
    constructor(
        @inject(DeleteTeamMemberByIdUseCase) private readonly deleteTeamMemberByIdUseCase: DeleteTeamMemberByIdUseCase,
        @inject(ListTeamMembersByTeamIdUseCase) private readonly listTeamMembersByTeamIdUseCase: ListTeamMembersByTeamIdUseCase,
        @inject(UpdateTeamMemberByIdUseCase) private readonly updateTeamMemberByIdUseCase: UpdateTeamMemberByIdUseCase
    ) {}

    private async run<T, E = ApplicationError>(execution: Promise<Result<T, E>>): Promise<T> {
        const result = await execution;
        if (!result.success) {
            throw result.error;
        }

        return result.value;
    }

    deleteById(
        input: UseCaseInput<DeleteTeamMemberByIdUseCase>
    ): Promise<UseCaseOutput<DeleteTeamMemberByIdUseCase>> {
        return this.run(this.deleteTeamMemberByIdUseCase.execute(input));
    }

    listByTeamId(
        input: UseCaseInput<ListTeamMembersByTeamIdUseCase>
    ): Promise<UseCaseOutput<ListTeamMembersByTeamIdUseCase>> {
        return this.run(this.listTeamMembersByTeamIdUseCase.execute(input));
    }

    updateById(
        input: UseCaseInput<UpdateTeamMemberByIdUseCase>
    ): Promise<UseCaseOutput<UpdateTeamMemberByIdUseCase>> {
        return this.run(this.updateTeamMemberByIdUseCase.execute(input));
    }
}
