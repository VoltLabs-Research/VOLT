import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { toPersistedOutput } from '@shared/domain/port/PersistedEntity';
import type { PersistedOutput } from '@shared/domain/port/PersistedEntity';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import type { ITeamRoleRepository } from '@modules/team/domain/port/ITeamRoleRepository';
import { TEAM_TOKENS } from '@modules/team/application/di/TeamTokens';
import { ErrorCodes } from '@core/constants/error-codes';
import type { TeamRoleProps } from '@modules/team/domain/entities/TeamRole';
import type { FindOptions } from '@shared/domain/port/IBaseRepository';

interface GetTeamRoleByIdInput {
    roleId: string;
    options?: Pick<FindOptions<unknown>, 'populate' | 'select'>;
}

@injectable()
export default class GetTeamRoleByIdUseCase implements IUseCase<GetTeamRoleByIdInput, PersistedOutput<TeamRoleProps>, ApplicationError> {
    constructor(
        @inject(TEAM_TOKENS.TeamRoleRepository)
        private readonly repository: ITeamRoleRepository
    ) {}

    async execute(input: GetTeamRoleByIdInput): Promise<Result<PersistedOutput<TeamRoleProps>, ApplicationError>> {
        const entity = await this.repository.findById(input.roleId, input.options);
        if (!entity) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.TEAM_ROLE_NOT_FOUND,
                'TeamRole not found'
            ));
        }
        return Result.ok(toPersistedOutput(entity));
    }
}
