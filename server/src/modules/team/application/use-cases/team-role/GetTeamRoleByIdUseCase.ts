import { ErrorCodes } from '@core/constants/error-codes';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { IUseCase } from '@shared/application/IUseCase';
import { toPersistedOutput } from '@shared/domain/port/PersistedEntity';
import { Result } from '@shared/domain/port/Result';
import { injectable, inject } from 'tsyringe';
import type { TeamRoleProps } from '@modules/team/domain/entities/team-role/TeamRole';
import type { ITeamRoleRepository } from '@modules/team/domain/port/team-role/ITeamRoleRepository';
import type { FindOptions } from '@shared/domain/port/IBaseRepository';
import type { PersistedOutput } from '@shared/domain/port/PersistedEntity';

interface GetTeamRoleByIdInput {
    roleId: string;
    options?: Pick<FindOptions<unknown>, 'populate' | 'select'>;
};

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
};
